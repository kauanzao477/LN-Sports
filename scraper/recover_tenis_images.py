#!/usr/bin/env python3
"""
recover_tenis_images.py
Recuperação completa das imagens de produtos 'Tênis Esportivos' da LN SPORTS.
Lê produtos.json, acessa os álbuns Yupoo (aj-dongli.x.yupoo.com) com a senha 888886,
extrai TODAS as fotos disponíveis (sem limites), elimina duplicatas e atualiza o catálogo JSON.
"""

import os
import sys
import json
import time
import asyncio
import re
import urllib.parse
from typing import List, Dict, Set, Tuple, Optional
import aiohttp

sys.stdout.reconfigure(encoding='utf-8')

# ── Configurações ─────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
JSON_SRC_PATH = os.path.join(PROJECT_ROOT, 'loja', 'src', 'data', 'produtos.json')
JSON_PUB_PATH = os.path.join(PROJECT_ROOT, 'loja', 'public', 'data', 'produtos.json')
JSON_PUB_ROOT_PATH = os.path.join(PROJECT_ROOT, 'loja', 'public', 'produtos.json')

RESULT_DIR = os.path.join(BASE_DIR, 'resultado')
CHECKPOINT_PATH = os.path.join(RESULT_DIR, 'checkpoint_tenis.json')
FAILURES_PATH = os.path.join(RESULT_DIR, 'falhas_tenis.json')
REPORT_PATH = os.path.join(RESULT_DIR, 'relatorio_final_tenis.json')

YUPOO_COOKIE = 'indexlockcode=888886; indexlockcodeRemember=888886'
CONCURRENCY = 16
REQUEST_DELAY = 0.04
TIMEOUT_SECONDS = 25
MAX_RETRIES = 3


DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
}


def extract_images_from_html(html_text: str, album_url: str) -> List[str]:
    """Extrai todas as imagens válidas de um álbum do Yupoo sem limite."""
    # 1. Procura os contêineres padrão do Yupoo
    containers = re.findall(
        r'<div[^>]+class="[^"]*(?:image__main|showalbum__children)[^"]*"[^>]*>.*?<img[^>]+>',
        html_text,
        re.DOTALL
    )

    extracted = []
    seen_urls: Set[str] = set()
    seen_hashes: Set[str] = set()

    for c in containers:
        m_origin = re.search(r'data-origin-src=["\']([^"\']+)["\']', c)
        m_src = re.search(r'data-src=["\']([^"\']+)["\']', c)
        m_fallback = re.search(r'src=["\']([^"\']+)["\']', c)

        chosen = None
        if m_origin and m_origin.group(1):
            chosen = m_origin.group(1)
        elif m_src and m_src.group(1):
            chosen = m_src.group(1)
        elif m_fallback and m_fallback.group(1):
            raw = m_fallback.group(1)
            if '/small.' not in raw:
                chosen = raw

        if chosen:
            if chosen.startswith('//'):
                chosen = 'https:' + chosen
            elif chosen.startswith('/'):
                chosen = urllib.parse.urljoin(album_url, chosen)

            # Ignora ícones/logos indesejados
            lower = chosen.lower()
            if any(k in lower for k in ['favicon', 'logo', 'qrcode', 'spinner', 'loading']):
                continue

            # Identifica hash da foto (ex: photo.yupoo.com/user/hash/...)
            hash_match = re.search(r'photo\.yupoo\.com/[^/]+/([a-f0-9]+)/', chosen)
            photo_hash = hash_match.group(1) if hash_match else chosen

            if photo_hash not in seen_hashes and chosen not in seen_urls:
                seen_hashes.add(photo_hash)
                seen_urls.add(chosen)
                extracted.append(chosen)

    # 2. Fallback por regex amplo caso o tema não use as classes padrão
    if not extracted:
        raw_photos = re.findall(r'(https?://photo\.yupoo\.com/[^/]+/[a-f0-9]+/[^\s"\'<>]+\.jpg)', html_text)
        for raw_u in raw_photos:
            if '/small.' in raw_u or '/medium.' in raw_u:
                continue
            hash_match = re.search(r'photo\.yupoo\.com/[^/]+/([a-f0-9]+)/', raw_u)
            photo_hash = hash_match.group(1) if hash_match else raw_u
            if photo_hash not in seen_hashes and raw_u not in seen_urls:
                seen_hashes.add(photo_hash)
                seen_urls.add(raw_u)
                extracted.append(raw_u)

    return extracted


async def fetch_album_images(
    session: aiohttp.ClientSession,
    url: str,
    semaphore: asyncio.Semaphore
) -> Tuple[bool, List[str], str]:
    """Busca o álbum Yupoo com retries e retorna (sucesso, imagens, erro)."""
    headers = dict(DEFAULT_HEADERS)
    parsed = urllib.parse.urlparse(url)
    headers['Referer'] = f"{parsed.scheme}://{parsed.netloc}/"
    headers['Cookie'] = YUPOO_COOKIE

    backoff = 1.5
    for attempt in range(MAX_RETRIES):
        async with semaphore:
            if REQUEST_DELAY > 0:
                await asyncio.sleep(REQUEST_DELAY)
            try:
                async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=TIMEOUT_SECONDS)) as resp:
                    if resp.status == 200:
                        text = await resp.text(encoding='utf-8', errors='ignore')
                        imgs = extract_images_from_html(text, url)
                        if imgs:
                            return True, imgs, ""
                        # Se não extraiu nada e tem tela de senha
                        if 'indexlock' in text.lower() and not ('image__main' in text or 'showalbum__children' in text):
                            return False, [], "Álbum bloqueado por senha"
                        return True, imgs, "Álbum vazio ou sem fotos válidas"

                    elif resp.status in (429, 503):
                        await asyncio.sleep(backoff)
                        backoff *= 2
                        continue
                    else:
                        return False, [], f"HTTP {resp.status}"
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                if attempt == MAX_RETRIES - 1:
                    return False, [], f"Exceção de rede: {type(e).__name__}"
                await asyncio.sleep(backoff)
                backoff *= 2

    return False, [], "Máximo de tentativas excedido"


def load_checkpoint() -> Dict[str, List[str]]:
    """Carrega checkpoint anterior se existir."""
    if os.path.exists(CHECKPOINT_PATH):
        try:
            with open(CHECKPOINT_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception:
            pass
    return {}


def save_checkpoint(checkpoint: Dict[str, List[str]]):
    """Salva checkpoint no disco atomicamente."""
    os.makedirs(RESULT_DIR, exist_ok=True)
    temp_file = CHECKPOINT_PATH + '.tmp'
    with open(temp_file, 'w', encoding='utf-8') as f:
        json.dump(checkpoint, f, ensure_ascii=False)
    os.replace(temp_file, CHECKPOINT_PATH)


def save_json_atomic(path: str, data: list):
    """Salva arquivo JSON atomicamente."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp = path + '.tmp'
    with open(temp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(temp, path)


async def main():
    print("=" * 70)
    print("RECUPERAÇÃO COMPLETA DE IMAGENS - TÊNIS ESPORTIVOS (LN SPORTS)")
    print("=" * 70)

    # 1. Carrega produtos.json
    print(f"[1/5] Lendo catálogo: {JSON_SRC_PATH}")
    with open(JSON_SRC_PATH, 'r', encoding='utf-8') as f:
        all_products = json.load(f)

    total_products_before = len(all_products)
    tenis_products = [p for p in all_products if p.get('category') == 'Tênis Esportivos']
    total_tenis_before = len(tenis_products)
    other_categories_count = total_products_before - total_tenis_before

    imgs_before_total = sum(len(p.get('images', [])) for p in tenis_products)
    avg_before = (imgs_before_total / total_tenis_before) if total_tenis_before > 0 else 0

    print(f"  Total de produtos no catálogo : {total_products_before}")
    print(f"  Total de 'Tênis Esportivos'   : {total_tenis_before}")
    print(f"  Outras categorias (intocadas) : {other_categories_count}")
    print(f"  Total de imagens antes        : {imgs_before_total}")
    print(f"  Média de imagens por tênis    : {avg_before:.2f}")

    # 2. Carrega Checkpoint
    checkpoint = load_checkpoint()
    print(f"[2/5] Checkpoint carregado: {len(checkpoint)} álbuns já processados anteriormente")

    # Mapeia índice no array original por sourceUrl para atualização rápida
    tenis_by_url = {p.get('sourceUrl'): p for p in tenis_products if p.get('sourceUrl')}

    # Determina quais produtos ainda precisam ser coletados
    pending_products = [p for p in tenis_products if p.get('sourceUrl') and p.get('sourceUrl') not in checkpoint]
    if '--limit' in sys.argv:
        lim_idx = sys.argv.index('--limit')
        if lim_idx + 1 < len(sys.argv):
            limit_val = int(sys.argv[lim_idx + 1])
            pending_products = pending_products[:limit_val]
            print(f"  [AVISO] Modo de teste ativado: limitando a {limit_val} produtos pendentes")

    print(f"[3/5] Produtos restantes para coletar: {len(pending_products)}")


    semaphore = asyncio.Semaphore(CONCURRENCY)
    connector = aiohttp.TCPConnector(limit=CONCURRENCY * 2, ttl_dns_cache=300)
    failures: List[Dict[str, str]] = []

    start_time = time.time()
    processed_count = 0
    total_to_process = len(pending_products)
    last_save_time = time.time()
    last_save_count = 0

    cookies = {
        'indexlockcode': '888886',
        'indexlockcodeRemember': '888886'
    }

    async with aiohttp.ClientSession(connector=connector, cookies=cookies) as session:

        # Sincroniza inicialmente produtos com o checkpoint existente
        synced_init = 0
        for p in tenis_products:
            url = p.get('sourceUrl')
            if url in checkpoint and len(checkpoint[url]) > len(p.get('images', [])):
                p['images'] = checkpoint[url]
                synced_init += 1
        if synced_init > 0:
            save_json_atomic(JSON_SRC_PATH, all_products)
            save_json_atomic(JSON_PUB_PATH, all_products)
            save_json_atomic(JSON_PUB_ROOT_PATH, all_products)
            print(f"  [SINCRONIZAÇÃO INICIAL] {synced_init} produtos atualizados do checkpoint para os 3 JSONs.")

        # Processamento em lotes de workers
        async def worker_task(prod):
            nonlocal processed_count
            url = prod.get('sourceUrl')
            success, imgs, err = await fetch_album_images(session, url, semaphore)
            processed_count += 1
            if success and imgs:
                checkpoint[url] = imgs
                prod['images'] = imgs  # ATUALIZAÇÃO IMEDIATA NO PRODUTO
            else:
                failures.append({
                    'name': prod.get('name', ''),
                    'sourceUrl': url,
                    'error': err or 'Nenhuma imagem encontrada'
                })

        # Executa em chunks para permitir salvamentos periódicos
        CHUNK_SIZE = 100
        for i in range(0, total_to_process, CHUNK_SIZE):
            chunk = pending_products[i:i + CHUNK_SIZE]
            tasks = [asyncio.create_task(worker_task(p)) for p in chunk]
            await asyncio.gather(*tasks)

            # Salva checkpoint e os 3 JSONs da loja a cada chunk
            save_checkpoint(checkpoint)
            save_json_atomic(JSON_SRC_PATH, all_products)
            save_json_atomic(JSON_PUB_PATH, all_products)
            save_json_atomic(JSON_PUB_ROOT_PATH, all_products)

            # Log de progresso
            elapsed = time.time() - start_time
            rate = (processed_count / elapsed) if elapsed > 0 else 0
            pct = ((processed_count + (len(tenis_products) - total_to_process)) / len(tenis_products)) * 100
            print(
                f"[{processed_count + (len(tenis_products) - total_to_process)}/{len(tenis_products)}] "
                f"{pct:.1f}% concluído | {rate:.1f} álbuns/s | Falhas: {len(failures)} | [3 JSONs atualizados em disco]"
            )



    # 4. Aplica todas as imagens recuperadas no catálogo completo
    print("\n[4/5] Aplicando todas as imagens recuperadas no catálogo...")
    corrected_count = 0
    unchanged_count = 0
    total_imgs_after = 0

    for p in tenis_products:
        url = p.get('sourceUrl')
        old_imgs = p.get('images', [])
        if url in checkpoint and checkpoint[url]:
            new_imgs = checkpoint[url]
            # Se encontrou mais imagens do que as atuais ou substitui lista incompleta
            if len(new_imgs) > len(old_imgs):
                p['images'] = new_imgs
                corrected_count += 1
            else:
                unchanged_count += 1
        else:
            unchanged_count += 1
        total_imgs_after += len(p.get('images', []))

    # 5. Salva nos JSONs oficiais da loja
    print("[5/5] Gravando arquivos JSON da loja...")
    save_json_atomic(JSON_SRC_PATH, all_products)
    save_json_atomic(JSON_PUB_PATH, all_products)

    if os.path.exists(JSON_PUB_ROOT_PATH):
        try:
            save_json_atomic(JSON_PUB_ROOT_PATH, all_products)
            print("  loja/public/produtos.json sincronizado com o catálogo completo.")
        except Exception as e:
            print(f"  Aviso ao sincronizar loja/public/produtos.json: {e}")


    # Salva relatório de falhas
    with open(FAILURES_PATH, 'w', encoding='utf-8') as f:
        json.dump(failures, f, ensure_ascii=False, indent=2)

    # Estatísticas Finais
    total_products_after = len(all_products)
    total_tenis_after = sum(1 for p in all_products if p.get('category') == 'Tênis Esportivos')
    avg_after = (total_imgs_after / total_tenis_after) if total_tenis_after > 0 else 0
    added_imgs = total_imgs_after - imgs_before_total

    report = {
        'total_produtos_antes': total_products_before,
        'total_produtos_depois': total_products_after,
        'tenis_esportivos_antes': total_tenis_before,
        'tenis_esportivos_depois': total_tenis_after,
        'produtos_novos_criados': total_products_after - total_products_before,
        'produtos_corrigidos': corrected_count,
        'produtos_sem_alteracao': unchanged_count,
        'produtos_com_falha': len(failures),
        'imagens_antes': imgs_before_total,
        'imagens_depois': total_imgs_after,
        'imagens_adicionadas': added_imgs,
        'media_imagens_antes': round(avg_before, 2),
        'media_imagens_depois': round(avg_after, 2),
        'tempo_total_segundos': round(time.time() - start_time, 2)
    }

    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 70)
    print("RELATÓRIO FINAL DA RECUPERAÇÃO DE IMAGENS:")
    print("=" * 70)
    print(f"  Total Produtos Antes          : {report['total_produtos_antes']}")
    print(f"  Total Produtos Depois         : {report['total_produtos_depois']}")
    print(f"  Tênis Esportivos Antes        : {report['tenis_esportivos_antes']}")
    print(f"  Tênis Esportivos Depois       : {report['tenis_esportivos_depois']}")
    print(f"  Produtos Novos Criados        : {report['produtos_novos_criados']} (CONFIRMADO 0)")
    print(f"  Produtos Corrigidos           : {report['produtos_corrigidos']}")
    print(f"  Produtos Sem Alteração        : {report['produtos_sem_alteracao']}")
    print(f"  Produtos com Falha            : {report['produtos_com_falha']}")
    print(f"  Imagens Totais Antes          : {report['imagens_antes']}")
    print(f"  Imagens Totais Depois         : {report['imagens_depois']}")
    print(f"  Imagens Novas Adicionadas     : {report['imagens_adicionadas']}")
    print(f"  Média de Imagens Antes        : {report['media_imagens_antes']:.2f}")
    print(f"  Média de Imagens Depois       : {report['media_imagens_depois']:.2f}")
    print(f"  Tempo Total                   : {report['tempo_total_segundos']}s")
    print("=" * 70)


if __name__ == '__main__':
    asyncio.run(main())
