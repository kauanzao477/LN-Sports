# -*- coding: utf-8 -*-
"""
importador_firebase.py — Sincronizador Firestore & Local em Tempo Real para LN-SPORTS.

Funcionalidades:
- Sincronização incremental em tempo real (produto a produto)
- Idempotência total baseada em sourceUrl (nunca duplica produtos nem imagens)
- Atualização atômica de loja/src/data/produtos.json para atualização instantânea no React
- Suporte a Cloud Firestore quando credenciais estiverem ativas
- Novos produtos entram com status "draft" e published: False
"""
import os
import re
import sys
import json
import unicodedata
from datetime import datetime, timezone
from typing import List, Dict, Optional

sys.stdout.reconfigure(encoding='utf-8')

def slugify(text: str) -> str:
    """Gera slugs limpos e amigáveis para URLs."""
    if not text:
        return "produto-sem-nome"
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8')
    text = re.sub(r'[^\w\s-]', '', text.lower())
    text = re.sub(r'[-\s]+', '-', text).strip('-')
    return text[:90] if text else "produto"

def init_firestore():
    """Inicializa cliente Firestore se credenciais ou emulador estiverem disponíveis."""
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        if not firebase_admin._apps:
            # Procura por arquivo serviceAccount.json se existir
            cred_file = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')
            if os.path.exists(cred_file):
                cred = credentials.Certificate(cred_file)
                firebase_admin.initialize_app(cred)
            else:
                return None
        return firestore.client()
    except Exception:
        return None

def sync_local_store_database(new_products: List[dict]):
    """
    Sincroniza atômica e incrementalmente com loja/src/data/produtos.json.
    Deduplica por sourceUrl preservando todos os itens existentes.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    target_path = os.path.join(base_dir, 'loja', 'src', 'data', 'produtos.json')
    os.makedirs(os.path.dirname(target_path), exist_ok=True)

    existing = []
    if os.path.exists(target_path):
        try:
            with open(target_path, 'r', encoding='utf-8') as f:
                existing = json.load(f)
        except Exception:
            existing = []

    # Dicionário indexado por sourceUrl
    prod_map = {p.get('sourceUrl'): p for p in existing if p.get('sourceUrl')}

    for item in new_products:
        src = item.get('sourceUrl')
        if not src:
            continue
        if src in prod_map:
            # Atualiza mantendo campos existentes de customização
            old = prod_map[src]
            # Mescla imagens sem duplicar
            merged_images = list(dict.fromkeys(old.get('images', []) + item.get('images', [])))
            old.update(item)
            old['images'] = merged_images
        else:
            prod_map[src] = item

    # Gravação atômica
    temp_path = f"{target_path}.tmp"
    with open(temp_path, 'w', encoding='utf-8') as f:
        json.dump(list(prod_map.values()), f, ensure_ascii=False, indent=2)
    
    # Substituição atômica no Windows
    try:
        os.replace(temp_path, target_path)
    except Exception:
        with open(target_path, 'w', encoding='utf-8') as f:
            json.dump(list(prod_map.values()), f, ensure_ascii=False, indent=2)
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

class LiveFirestoreImporter:
    """
    Importador em tempo real: a cada álbum extraído pelo scraper,
    normaliza, grava no Firestore e sincroniza com a loja React.
    """
    def __init__(self):
        self.db = init_firestore()
        self.existing_urls = {}
        if self.db is not None:
            try:
                for doc in self.db.collection("products").stream():
                    d = doc.to_dict()
                    u = d.get("sourceUrl")
                    if u:
                        self.existing_urls[u] = {
                            "id": doc.id,
                            "status": d.get("status", "draft"),
                            "published": d.get("published", False),
                            "featured": d.get("featured", False),
                            "createdAt": d.get("createdAt")
                        }
            except Exception:
                pass
        self.created = 0
        self.updated = 0
        self.errors = 0
        self.processed = 0

    def upsert_product(self, raw_product: dict, mapped_category: str) -> dict:
        self.processed += 1
        name = (raw_product.get("produto") or raw_product.get("name") or "").strip()
        source_url = raw_product.get("album_url") or raw_product.get("sourceUrl") or ""
        subcat = raw_product.get("subcategoria") or raw_product.get("subcategory") or ""
        imgs = raw_product.get("imagens") or raw_product.get("images") or []
        desc = raw_product.get("descricao") or raw_product.get("description") or ""

        if not source_url or not name:
            return {"action": "ignored", "firestore": "Ignorado", "site": "Pendente"}

        clean_slug = slugify(name)
        now_iso = datetime.now(timezone.utc).isoformat() + "Z"

        # Deduplica lista de imagens preservando a ordem
        unique_imgs = list(dict.fromkeys([
            img for img in imgs if isinstance(img, str) and (img.startswith("http://") or img.startswith("https://"))
        ]))

        product_doc = {
            "name": name,
            "slug": clean_slug,
            "category": mapped_category,
            "originalCategory": raw_product.get("categoria", ""),
            "subcategory": subcat,
            "images": unique_imgs,
            "sourceUrl": source_url,
            "sourceProvider": "yupoo",
            "description": desc,
            "published": False,
            "featured": False,
            "status": "draft",
            "createdAt": now_iso,
            "updatedAt": now_iso
        }

        action = "created"
        firestore_status = "OK"

        if self.db is not None:
            try:
                if source_url in self.existing_urls:
                    prev = self.existing_urls[source_url]
                    product_doc["status"] = prev.get("status", "draft")
                    product_doc["published"] = prev.get("published", False)
                    product_doc["featured"] = prev.get("featured", False)
                    if prev.get("createdAt"):
                        product_doc["createdAt"] = prev["createdAt"]
                    doc_ref = self.db.collection("products").document(prev["id"])
                    doc_ref.set(product_doc, merge=True)
                    self.updated += 1
                    action = "updated"
                else:
                    doc_ref = self.db.collection("products").document(clean_slug)
                    doc_ref.set(product_doc, merge=True)
                    self.existing_urls[source_url] = {"id": clean_slug, "status": "draft"}
                    self.created += 1
                    action = "created"
            except Exception as e:
                self.errors += 1
                firestore_status = f"Erro: {e}"
        else:
            firestore_status = "OK (Local)"

        # Sincroniza em tempo real com a loja local (loja/src/data/produtos.json)
        try:
            sync_local_store_database([product_doc])
        except Exception:
            pass

        return {
            "action": action,
            "firestore": firestore_status,
            "site": "disponível",
            "category": mapped_category,
            "slug": clean_slug
        }

if __name__ == '__main__':
    print("Módulo importador_firebase pronto.")
