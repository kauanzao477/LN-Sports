#!/usr/bin/env python3
"""
recuperar_313_direcionados.py
Recuperação direcionada EXCLUSIVAMENTE dos produtos identificados com 4+ imagens no Yupoo,
mas atualmente com 1-3 imagens no catálogo.
"""

import os
import sys
import json
import time
import shutil
import asyncio
import urllib.parse
from typing import List, Dict, Set, Tuple
import aiohttp

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
JSON_SRC_PATH = os.path.join(PROJECT_ROOT, 'loja', 'src', 'data', 'produtos.json')
JSON_PUB_PATH = os.path.join(PROJECT_ROOT, 'loja', 'public', 'data', 'produtos.json')
JSON_PUB_ROOT_PATH = os.path.join(PROJECT_ROOT, 'loja', 'public', 'produtos.json')

RESULT_DIR = os.path.join(BASE_DIR, 'resultado')
FALHAS_PATH = os.path.join(RESULT_DIR, 'falhas_tenis.json')
CHECKPOINT_PATH = os.path.join(RESULT_DIR, 'checkpoint_tenis.json')
LOG_313_RECUPERADOS = os.path.join(RESULT_DIR, 'recuperados_313_log.json')

from recover_tenis_images import extract_images_from_html

YUPOO_COOKIE = 'indexlockcode=888886; indexlockcodeRemember=888886'
DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
}

CONCURRENCY = 4  # Concorrência moderada para evitar qualquer rate limit
REQUEST_DELAY = 0.2  # 200ms entre requisições
TIMEOUT_SECONDS = 20
MAX_RETRIES = 3

async def fetch_target_album(session, url, sem):
    headers = dict(DEFAULT_HEADERS)
    parsed = urllib.parse.urlparse(url)
    headers['Referer'] = f"{parsed.scheme}://{parsed.netloc}/"
    headers['Cookie'] = YUPOO_COOKIE

    backoff = 2.0
    for attempt in range(MAX_RETRIES):
        async with sem:
            if REQUEST_DELAY > 0:
                await asyncio.sleep(REQUEST_DELAY)
            try:
                async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=TIMEOUT_SECONDS)) as resp:
                    if resp.status == 200:
                        html = await resp.text(encoding='utf-8', errors='ignore')
                        imgs = extract_images_from_html(html, url)
                        return True, imgs, ""
                    elif resp.status in (429, 503):
                        await asyncio.sleep(backoff)
                        backoff *= 2
                        continue
                    else:
                        return False, [], f"HTTP {resp.status}"
            except Exception as e:
                if attempt == MAX_RETRIES - 1:
                    return False, [], f"Erro: {type(e).__name__}"
                await asyncio.sleep(backoff)
                backoff *= 2
    return False, [], "Tentativas esgotadas"

def save_json_atomic(path: str, data: list):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp = path + '.tmp'
    with open(temp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(temp, path)

async def main():
    print("=" * 75)
    print("RECUPERAÇÃO DIRECIONADA: PRODUTOS COM 4+ IMAGENS NO YUPOO")
    print("=" * 75)

    # 1. Carrega catálogo atual
    with open(JSON_SRC_PATH, 'r', encoding='utf-8') as f:
        all_products = json.load(f)

    total_before = len(all_products)
    tenis_before = [p for p in all_products if p.get('category') == 'Tênis Esportivos']
    tenis_1_3_before = [p for p in tenis_before if len(p.get('images', [])) <= 3]
    imgs_tenis_before = sum(len(p.get('images', [])) for p in tenis_before)

    print(f"Total de produtos no catálogo : {total_before}")
    print(f"Total de Tênis Esportivos     : {len(tenis_before)}")
    print(f"Tênis com 1 a 3 fotos antes   : {len(tenis_1_3_before)}")
    print(f"Total de fotos em Tênis antes : {imgs_tenis_before}")

    # 2. Backup prévio obrigatório
    backup_src = JSON_SRC_PATH.replace('.json', '_backup_antes_313.json')
    backup_pub = JSON_PUB_PATH.replace('.json', '_backup_antes_313.json')
    backup_pub_root = JSON_PUB_ROOT_PATH.replace('.json', '_backup_antes_313.json')
    shutil.copyfile(JSON_SRC_PATH, backup_src)
    shutil.copyfile(JSON_PUB_PATH, backup_pub)
    shutil.copyfile(JSON_PUB_ROOT_PATH, backup_pub_root)
    print(f"\n[BACKUP OK] Backups criados com sucesso:")
    print(f"  - {backup_src}")
    print(f"  - {backup_pub}")
    print(f"  - {backup_pub_root}")

    # 3. Carrega lista de falhas identificada pela auditoria
    with open(FALHAS_PATH, 'r', encoding='utf-8') as f:
        falhas_list = json.load(f)

    # Mapeamento de produtos por sourceUrl
    product_map = {p.get('sourceUrl'): p for p in tenis_before if p.get('sourceUrl')}

    # Carrega checkpoint para também atualizar caso haja sucesso
    checkpoint = {}
    if os.path.exists(CHECKPOINT_PATH):
        with open(CHECKPOINT_PATH, 'r', encoding='utf-8') as f:
            checkpoint = json.load(f)

    # Coleta os alvos
    targets = [f for f in falhas_list if f.get('sourceUrl') in product_map]
    print(f"\nTotal de candidatos de falhas a auditar/recuperar: {len(targets)}")

    cookies = {'indexlockcode': '888886', 'indexlockcodeRemember': '888886'}
    sem = asyncio.Semaphore(CONCURRENCY)

    recuperados_com_sucesso = []
    permaneceram_com_falha = []
    ignorados_poucas_fotos = []

    start_time = time.time()
    async with aiohttp.ClientSession(cookies=cookies) as session:
        for idx, item in enumerate(targets, 1):
            url = item.get('sourceUrl')
            prod = product_map.get(url)
            current_imgs_len = len(prod.get('images', []))

            success, imgs, err = await fetch_target_album(session, url, sem)

            if success and len(imgs) >= 4:
                # Confirma que encontrou mais imagens do que as atuais
                if len(imgs) > current_imgs_len:
                    old_len = current_imgs_len
                    prod['images'] = imgs  # Atualiza o produto
                    checkpoint[url] = imgs # Atualiza o checkpoint
                    recuperados_com_sucesso.append({
                        'name': prod.get('name'),
                        'sourceUrl': url,
                        'antes': old_len,
                        'depois': len(imgs),
                        'ganho': len(imgs) - old_len
                    })
                    print(f"[{idx}/{len(targets)}] [RECUPERADO] {prod.get('name')[:35]}... ({old_len} -> {len(imgs)} fotos)")
                else:
                    ignorados_poucas_fotos.append({'sourceUrl': url, 'imgs': len(imgs), 'motivo': 'mesma quantidade'})
            elif success and len(imgs) < 4:
                ignorados_poucas_fotos.append({'sourceUrl': url, 'imgs': len(imgs), 'motivo': 'realmente tem 1-3 fotos'})
            else:
                permaneceram_com_falha.append({
                    'name': prod.get('name'),
                    'sourceUrl': url,
                    'erro': err
                })

    elapsed = time.time() - start_time
    print(f"\nVarredura finalizada em {elapsed:.1f}s.")
    print(f"  - Produtos recuperados com sucesso (4+ fotos): {len(recuperados_com_sucesso)}")
    print(f"  - Produtos que realmente só têm 1-3 fotos    : {len(ignorados_poucas_fotos)}")
    print(f"  - Produtos que permaneceram em falha/timeout : {len(permaneceram_com_falha)}")

    # 4. Grava os 3 JSONs oficiais atomicamente
    print("\nGravando os 3 arquivos JSON oficiais da loja...")
    save_json_atomic(JSON_SRC_PATH, all_products)
    save_json_atomic(JSON_PUB_PATH, all_products)
    save_json_atomic(JSON_PUB_ROOT_PATH, all_products)

    # Salva checkpoint atualizado
    with open(CHECKPOINT_PATH, 'w', encoding='utf-8') as f:
        json.dump(checkpoint, f, ensure_ascii=False)

    # Salva log de recuperação
    log_data = {
        'total_alvos_analisados': len(targets),
        'recuperados_sucesso': recuperados_com_sucesso,
        'permaneceram_falha': permaneceram_com_falha,
        'ignorados_1_a_3_fotos': ignorados_poucas_fotos
    }
    with open(LOG_313_RECUPERADOS, 'w', encoding='utf-8') as f:
        json.dump(log_data, f, ensure_ascii=False, indent=2)

    # Salva falhas_tenis.json atualizado apenas com os que realmente persistiram em falha
    with open(FALHAS_PATH, 'w', encoding='utf-8') as f:
        json.dump(permaneceram_com_falha, f, ensure_ascii=False, indent=2)

    # 5. Validações finais
    imgs_tenis_after = sum(len(p.get('images', [])) for p in tenis_before)
    novas_imgs = imgs_tenis_after - imgs_tenis_before
    tenis_1_3_after = [p for p in tenis_before if len(p.get('images', [])) <= 3]

    print("\n" + "=" * 75)
    print("MÉTRICAS DA OPERAÇÃO DIRECIONADA:")
    print("=" * 75)
    print(f"1. Produtos recuperados com sucesso: {len(recuperados_com_sucesso)}")
    print(f"2. Novas imagens adicionadas       : +{novas_imgs} fotos")
    print(f"3. Produtos que ficaram com 1-3    : {len(tenis_1_3_after)}")
    print(f"4. Produtos que falharam novamente : {len(permaneceram_com_falha)}")
    print(f"5. Total produtos no catálogo      : {len(all_products)} (permanece inalterado)")
    print("=" * 75)

if __name__ == '__main__':
    asyncio.run(main())
