# -*- coding: utf-8 -*-
"""
Script Principal do Scraper e Importador de Produtos e Álbuns Yupoo — LN-SPORTS.

Fluxo: Yupoo → scraper → produtos.json → site React

- Cada produto recebe estritamente a categoria correspondente à sua fonte.
- Prioriza fontes/categorias com poucos ou nenhum produto cadastrado.
- Salva imediatamente a cada álbum no produtos.json da loja e de resultado/.
- Retoma de onde parou usando sourceUrl/album_url (sem duplicação nem retrabalho).
- Opera de forma contínua com concorrência controlada e alta velocidade.
"""
import os
import sys
import csv
import json
import time
import shutil
import argparse
import asyncio
import unicodedata
import re
from datetime import datetime, timezone
from typing import List, Dict, Set, Optional

# Força terminal Windows a utilizar codificação UTF-8
sys.stdout.reconfigure(encoding='utf-8')

try:
    from colorama import init, Fore, Style
    init(autoreset=True)
except ImportError:
    class Fore:
        CYAN = GREEN = YELLOW = RED = MAGENTA = BLUE = WHITE = RESET = ""
    class Style:
        BRIGHT = RESET_ALL = ""

from config import (
    MAX_WORKERS, DEFAULT_INPUT_FILE, DEFAULT_OUTPUT_DIR,
    FILE_PRODUTOS_JSON, FILE_PRODUTOS_CSV, FILE_IMAGE_URLS,
    FILE_ERROS, FILE_PROGRESSO
)
from crawler import AsyncHttpClient, CatalogCrawler
from extractor import ProductExtractor, extract_photo_hash
from category_mapper import map_category, OFFICIAL_CATEGORIES

def slugify(text: str) -> str:
    """Gera slugs limpos e amigáveis para URLs, compatíveis com a loja React."""
    if not text:
        return "produto-sem-nome"
    text = unicodedata.normalize('NFKD', str(text)).encode('ascii', 'ignore').decode('utf-8')
    text = re.sub(r'[^\w\s-]', '', text.lower())
    text = re.sub(r'[-\s]+', '-', text).strip('-')
    return text[:90] if text else "produto"

def format_number(n: int) -> str:
    """Formata números no padrão brasileiro com ponto separador de milhar."""
    return f"{n:,}".replace(',', '.')

def load_input_links(filepath: str) -> List[str]:
    """Lê links.txt ignorando comentários e linhas vazias."""
    if not os.path.exists(filepath):
        return []
    links = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            clean = line.strip()
            if clean and not clean.startswith('#'):
                links.append(clean)
    return links

def get_source_category(url: str) -> str:
    """Identifica a categoria oficial exata configurada para o link de entrada."""
    return map_category(raw_name="", album_url=url, source_link=url)

class IncrementalStorage:
    """
    Gerencia a escrita incremental e atômica após cada álbum processado.
    Atualiza loja/src/data/produtos.json e resultado/produtos.json em tempo real.
    """

    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        self.json_path = os.path.join(output_dir, FILE_PRODUTOS_JSON)
        self.csv_path = os.path.join(output_dir, FILE_PRODUTOS_CSV)
        self.urls_path = os.path.join(output_dir, FILE_IMAGE_URLS)
        self.erros_path = os.path.join(output_dir, FILE_ERROS)
        self.progresso_path = os.path.join(output_dir, FILE_PROGRESSO)

        # Caminhos oficiais da loja React
        workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        self.loja_json_path = os.path.join(workspace_root, 'loja', 'src', 'data', 'produtos.json')
        self.loja_public_json_path = os.path.join(workspace_root, 'loja', 'public', 'produtos.json')
        os.makedirs(os.path.dirname(self.loja_json_path), exist_ok=True)
        os.makedirs(os.path.dirname(self.loja_public_json_path), exist_ok=True)

        self.catalog: List[Dict] = []
        self.loja_products_map: Dict[str, dict] = {}
        self.unique_image_urls: Set[str] = set()
        self.processed_urls: Set[str] = set()
        self.errors_count: int = 0
        self.max_images_in_product: int = 0

    def load_existing_state(self):
        """Carrega dados existentes para retomar de onde parou sem reprocessar nada."""
        # 1. Carrega produtos existentes da loja React (fonte oficial)
        if os.path.exists(self.loja_json_path):
            try:
                with open(self.loja_json_path, 'r', encoding='utf-8') as f:
                    loja_data = json.load(f)
                    for item in loja_data:
                        src = item.get('sourceUrl')
                        if src:
                            self.loja_products_map[src] = item
                            self.processed_urls.add(src)
                        for img in item.get('images', []):
                            if img:
                                self.unique_image_urls.add(img)
                print(f"{Fore.GREEN}📦 Base da loja carregada: {format_number(len(self.loja_products_map))} produtos existentes identificados.")
            except Exception as e:
                print(f"{Fore.YELLOW}[AVISO] Falha ao ler produtos.json da loja: {e}")

        # 2. Carrega resultado/progresso.json se houver
        if os.path.exists(self.progresso_path):
            try:
                with open(self.progresso_path, 'r', encoding='utf-8') as f:
                    state = json.load(f)
                    for u in state.get('processed_urls', []):
                        self.processed_urls.add(u)
                    self.catalog = state.get('catalog', [])
                    self.errors_count = state.get('errors_count', 0)
                    for p in self.catalog:
                        imgs = p.get('imagens', [])
                        self.unique_image_urls.update(imgs)
                        if len(imgs) > self.max_images_in_product:
                            self.max_images_in_product = len(imgs)
            except Exception:
                pass

    def safe_backup_and_reset(self):
        """Em caso de --restart, faz backup de segurança antes de reiniciar."""
        if os.path.exists(self.output_dir):
            backup_name = f"{self.output_dir}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            try:
                shutil.copytree(self.output_dir, backup_name)
                print(f"{Fore.YELLOW}🛡️ [BACKUP SEGURO] Dados anteriores salvos em: {backup_name}")
            except Exception:
                pass

        for f in [self.json_path, self.csv_path, self.urls_path, self.progresso_path]:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except Exception:
                    pass

        self.catalog = []
        self.unique_image_urls = set()
        self.processed_urls = set()
        self.errors_count = 0
        self.max_images_in_product = 0

    def add_album_result(self, product_data: dict):
        """Adiciona o produto processado e atualiza TODOS os arquivos imediatamente."""
        album_url = product_data['album_url']
        self.processed_urls.add(album_url)

        if product_data.get('status') == 'error':
            self.errors_count += 1
            self.log_error(f"Falha ao acessar: {album_url}")
            self.save_progresso()
            return

        imgs = product_data.get('imagens', [])
        unique_imgs = list(dict.fromkeys([
            u for u in imgs if isinstance(u, str) and (u.startswith('http://') or u.startswith('https://'))
        ]))

        prod_name = (product_data.get('produto') or 'Sem título').strip()
        cat = product_data.get('categoria', '')
        subcat = product_data.get('subcategoria', '')
        clean_slug = slugify(prod_name)
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Catálogo local do scraper (formato legado / resultado/)
        self.catalog.append({
            'categoria': cat,
            'subcategoria': subcat,
            'produto': prod_name,
            'album_url': album_url,
            'imagens': unique_imgs
        })

        new_urls = []
        for u in unique_imgs:
            if u not in self.unique_image_urls:
                self.unique_image_urls.add(u)
                new_urls.append(u)

        if len(unique_imgs) > self.max_images_in_product:
            self.max_images_in_product = len(unique_imgs)

        # 1.5 FOTO PRIMÁRIA = capa oficial do álbum (foto do tênis EM PAR).
        # O extractor captura o hash da tag og:image; casamos esse hash com a
        # foto em alta resolução da lista (mesma regra do frontend coverUtils).
        # Se não houver capa válida, mantém 0 (comportamento anterior).
        cover_hash = (product_data.get('cover_hash') or '').strip().lower()
        main_image_index = 0
        if cover_hash:
            for idx, u in enumerate(unique_imgs):
                if extract_photo_hash(u) == cover_hash:
                    main_image_index = idx
                    break

        # 2. Formato oficial da loja React (loja/src/data/produtos.json)
        loja_doc = {
            "name": prod_name,
            "slug": clean_slug,
            "category": cat,
            "originalCategory": product_data.get('categoria_original', cat),
            "subcategory": subcat,
            "images": unique_imgs,
            "coverHash": cover_hash,
            "mainImageIndex": main_image_index,
            "sourceUrl": album_url,
            "sourceProvider": "yupoo",
            "description": product_data.get('descricao', f"{prod_name} - {cat}"),
            "published": True,
            "featured": False,
            "status": "published",
            "createdAt": now_iso,
            "updatedAt": now_iso
        }
        self.loja_products_map[album_url] = loja_doc

        # Salva imediatamente no banco da loja React
        self.save_loja_json()

        # Atualiza arquivos adicionais incrementalmente
        self.save_json()
        self.save_csv()
        self.append_image_urls(new_urls)
        self.save_progresso()

    def save_loja_json(self):
        """Grava loja/public/produtos.json e loja/src/data/produtos.json de forma atômica."""
        json_data = list(self.loja_products_map.values())
        for target_path in [self.loja_public_json_path, self.loja_json_path]:
            temp_path = f"{target_path}.tmp"
            try:
                with open(temp_path, 'w', encoding='utf-8') as f:
                    json.dump(json_data, f, ensure_ascii=False, indent=2)
                os.replace(temp_path, target_path)
            except Exception:
                try:
                    with open(target_path, 'w', encoding='utf-8') as f:
                        json.dump(json_data, f, ensure_ascii=False, indent=2)
                except Exception:
                    pass
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except Exception:
                        pass

    def save_json(self):
        """Grava resultado/produtos.json de forma atômica."""
        temp_path = f"{self.json_path}.tmp"
        try:
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(self.catalog, f, ensure_ascii=False, indent=2)
            os.replace(temp_path, self.json_path)
        except Exception:
            with open(self.json_path, 'w', encoding='utf-8') as f:
                json.dump(self.catalog, f, ensure_ascii=False, indent=2)

    def save_csv(self):
        """Grava produtos.csv."""
        headers = ['categoria', 'subcategoria', 'produto', 'album_url']
        limit = max(self.max_images_in_product, 1)
        for i in range(1, limit + 1):
            headers.append(f'imagem_{i}')

        with open(self.csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            for p in self.catalog:
                row = [
                    p.get('categoria', ''),
                    p.get('subcategoria', ''),
                    p.get('produto', ''),
                    p.get('album_url', '')
                ]
                row.extend(p.get('imagens', []))
                writer.writerow(row)

    def append_image_urls(self, new_urls: List[str]):
        """Acrescenta URLs únicas em image_urls.txt."""
        if not new_urls:
            return
        with open(self.urls_path, 'a', encoding='utf-8') as f:
            for u in new_urls:
                f.write(f"{u}\n")

    def save_progresso(self):
        """Salva progresso.json."""
        state = {
            'processed_urls': list(self.processed_urls),
            'catalog': self.catalog,
            'errors_count': self.errors_count,
            'total_unique_images': len(self.unique_image_urls),
            'total_loja_products': len(self.loja_products_map),
            'last_update': datetime.now().isoformat()
        }
        with open(self.progresso_path, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)

    def log_error(self, message: str):
        """Registra erro em erros.txt."""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        with open(self.erros_path, 'a', encoding='utf-8') as f:
            f.write(f"[{timestamp}] {message}\n")

async def process_album_task(
    http_client: AsyncHttpClient,
    album_info: dict,
    semaphore: asyncio.Semaphore,
    debug: bool
) -> dict:
    """Extrai informações de um álbum com controle de semáforo assíncrono."""
    album_url = album_info['album_url']
    cat = album_info.get('categoria', '')
    subcat = album_info.get('subcategoria', '')

    async with semaphore:
        status, html_content = await http_client.fetch_text(album_url)
        if status != 200:
            return {
                'album_url': album_url,
                'categoria': cat,
                'subcategoria': subcat,
                'produto': 'Falha ao acessar',
                'imagens': [],
                'status': 'error',
                'error': f"HTTP {status}"
            }

        if 'yupoo.com' in album_url:
            data = ProductExtractor.extract_yupoo_album(
                html_content, album_url, cat, subcat, debug=debug
            )
        else:
            data = ProductExtractor.extract_generic_album(
                html_content, album_url, cat, subcat, debug=debug
            )

        data['status'] = 'ok'
        return data

async def run_scraper(args):
    start_time = time.time()
    input_file = args.input or DEFAULT_INPUT_FILE
    output_dir = args.output or DEFAULT_OUTPUT_DIR
    workers = args.workers or MAX_WORKERS or 6
    is_test_mode = args.test
    is_debug = args.debug
    is_restart = args.restart

    storage = IncrementalStorage(output_dir)

    print(f"\n{Fore.CYAN}{'='*65}")
    print(f"{Fore.CYAN}{Style.BRIGHT}🚀 SCRAPER & IMPORTADOR YUPOO — LN-SPORTS")
    print(f"{Fore.CYAN}{'='*65}")
    print(f"{Fore.WHITE}📁 Arquivo de entrada:     {Fore.YELLOW}{input_file}")
    print(f"{Fore.WHITE}📂 Pasta de saída:         {Fore.YELLOW}{output_dir}")
    print(f"{Fore.WHITE}⚡ Conexões simultâneas:   {Fore.YELLOW}{workers}")
    if is_debug:
        print(f"{Fore.MAGENTA}🐞 MODO DEBUG ATIVO")
    if is_test_mode:
        print(f"{Fore.GREEN}{Style.BRIGHT}🧪 MODO TESTE ATIVO")
    print(f"{Fore.CYAN}{'='*65}\n")

    input_urls = load_input_links(input_file)
    if not input_urls:
        print(f"{Fore.RED}[ERRO] Nenhuma URL encontrada em {input_file}!")
        return

    # Tratamento de reinicialização ou continuação
    if is_restart:
        storage.safe_backup_and_reset()
    else:
        storage.load_existing_state()

    # PRIORIZAÇÃO INTELIGENTE DAS CATEGORIAS
    # Calcula quantos produtos cada categoria já possui na base
    category_counts = {}
    for p in storage.loja_products_map.values():
        c = p.get('category', '')
        category_counts[c] = category_counts.get(c, 0) + 1

    print(f"{Fore.WHITE}{Style.BRIGHT}📊 Contagem atual por categoria na base:")
    for off in OFFICIAL_CATEGORIES:
        cnt = category_counts.get(off, 0)
        color = Fore.GREEN if cnt > 50 else (Fore.YELLOW if cnt > 0 else Fore.RED)
        print(f"  {color}• {off}: {format_number(cnt)} produtos")
    print()

    # Mapeia cada URL de entrada para sua categoria canônica e ordena pelas que têm menos produtos
    sources_to_scrape = []
    for url in input_urls:
        cat = get_source_category(url)
        current_count = category_counts.get(cat, 0)
        sources_to_scrape.append({
            'url': url,
            'category': cat,
            'current_count': current_count
        })

    # Ordena: categorias com MENOS produtos primeiro (prioriza chuteiras, tênis, sapatilhas)
    sources_to_scrape.sort(key=lambda s: s['current_count'])

    print(f"{Fore.BLUE}{Style.BRIGHT}🎯 Ordem de prioridade de coleta definida:")
    for idx, s in enumerate(sources_to_scrape, 1):
        print(f"  {idx}. [{s['category']}] (Atual: {s['current_count']}) -> {s['url']}")
    print()

    async with AsyncHttpClient() as http_client:
        crawler = CatalogCrawler(http_client)
        semaphore = asyncio.Semaphore(workers)

        total_new_collected = 0

        # PROCESSA CADA FONTE PROGRESSIVAMENTE
        for src_idx, source in enumerate(sources_to_scrape, 1):
            src_url = source['url']
            src_cat = source['category']
            print(f"\n{Fore.CYAN}{'='*65}")
            print(f"{Fore.CYAN}🔍 [Fonte {src_idx}/{len(sources_to_scrape)}] {src_cat}")
            print(f"{Fore.WHITE}URL: {Fore.YELLOW}{src_url}")
            print(f"{Fore.CYAN}{'='*65}")

            max_source_albums = args.sample_per_source or (3 if is_test_mode else None)

            if 'yupoo.com' in src_url:
                albums = await crawler.discover_all_albums_yupoo(
                    start_url=src_url,
                    on_progress=lambda msg: print(f"{Fore.WHITE}  {msg}"),
                    debug=is_debug,
                    max_albums=max_source_albums,
                    source_category=src_cat
                )
            else:
                albums = await crawler.discover_generic_albums(
                    start_url=src_url,
                    on_progress=lambda msg: print(f"{Fore.WHITE}  {msg}")
                )

            # Filtra os álbuns que ainda não existem
            pending_albums = [
                a for a in albums if a['album_url'] not in storage.processed_urls
            ]

            print(f"{Fore.GREEN}  Total descoberto nesta fonte: {len(albums)} álbuns.")
            print(f"{Fore.YELLOW}  Já existentes / ignorados:    {len(albums) - len(pending_albums)} álbuns.")
            print(f"{Fore.CYAN}  Novos para coletar agora:     {len(pending_albums)} álbuns.\n")

            if not pending_albums:
                print(f"{Fore.GREEN}  ✅ Todos os produtos desta fonte já estão coletados e sincronizados.")
                continue

            if args.limit:
                pending_albums = pending_albums[:args.limit]

            # Coleta cada produto e salva IMEDIATAMENTE no produtos.json
            for p_idx, alb in enumerate(pending_albums, 1):
                res = await process_album_task(http_client, alb, semaphore, debug=is_debug)

                prod_title = res.get('produto', 'Sem título')
                imgs = res.get('imagens', [])

                # Categoria garantida e estrita da fonte
                res['categoria'] = src_cat
                res['categoria_original'] = alb.get('categoria', src_cat)

                # Salva IMEDIATAMENTE no produtos.json
                storage.add_album_result(res)
                total_new_collected += 1

                global_total = len(storage.loja_products_map)

                if res.get('status') == 'error':
                    print(f"{Fore.RED}[{p_idx}/{len(pending_albums)}] Categoria: {src_cat} | Erro ao acessar: {alb.get('album_url')}")
                else:
                    print(f"{Fore.CYAN}[{p_idx}/{len(pending_albums)}] {Fore.WHITE}Categoria: {Fore.YELLOW}{src_cat} | {Fore.WHITE}Produto: {Fore.WHITE}{prod_title[:45]} | {Fore.GREEN}{len(imgs)} imgs | {Fore.GREEN}produtos.json: OK (Total Loja: {format_number(global_total)})")

    elapsed = time.time() - start_time
    mins, secs = divmod(int(elapsed), 60)
    time_str = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"

    print("\n" + "=" * 50)
    print("LN-SPORTS — COLETA INCREMENTAL CONCLUÍDA")
    print("=" * 50)
    print(f"Tempo total decorrido:         {time_str}")
    print(f"Novos produtos adicionados:    {format_number(total_new_collected)}")
    print(f"Total geral no produtos.json:  {format_number(len(storage.loja_products_map))}")
    print("=" * 50 + "\n")

def main():
    parser = argparse.ArgumentParser(description="Scraper & Importador Yupoo - LN-Sports")
    parser.add_argument('--input', '-i', help="Arquivo de links (padrão: links.txt)")
    parser.add_argument('--output', '-o', help="Diretório de saída (padrão: resultado/)")
    parser.add_argument('--workers', '-w', type=int, help="Número de workers assíncronos (padrão: 6)")
    parser.add_argument('--limit', '-l', type=int, default=None, help="Limite opcional de álbuns")
    parser.add_argument('--sample-per-source', type=int, default=None, help="Coleta amostra de N álbuns por fonte")
    parser.add_argument('--test', action='store_true', help="Modo teste")
    parser.add_argument('--debug', action='store_true', help="Modo debug")
    parser.add_argument('--restart', action='store_true', help="Reinicia do zero com backup seguro")
    args = parser.parse_args()

    asyncio.run(run_scraper(args))

if __name__ == '__main__':
    main()
