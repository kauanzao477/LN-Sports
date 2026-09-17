import asyncio
import aiohttp
import json
import random
import re
import sys
import urllib.parse

sys.stdout.reconfigure(encoding='utf-8')

YUPOO_COOKIE = 'indexlockcode=888886; indexlockcodeRemember=888886'
DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
}

from recover_tenis_images import extract_images_from_html

async def check_album(session, url, sem):
    headers = dict(DEFAULT_HEADERS)
    parsed = urllib.parse.urlparse(url)
    headers['Referer'] = f"{parsed.scheme}://{parsed.netloc}/"
    headers['Cookie'] = YUPOO_COOKIE

    async with sem:
        try:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                if resp.status == 200:
                    html = await resp.text(encoding='utf-8', errors='ignore')
                    imgs = extract_images_from_html(html, url)
                    is_empty = 'album not found' in html.lower() or 'not exist' in html.lower()
                    return {'url': url, 'status': 200, 'imgs': len(imgs), 'empty': is_empty}
                elif resp.status == 404:
                    return {'url': url, 'status': 404, 'imgs': 0, 'empty': True}
                else:
                    return {'url': url, 'status': resp.status, 'imgs': 0, 'empty': False}
        except Exception as e:
            return {'url': url, 'status': f'ERR_{type(e).__name__}', 'imgs': 0, 'empty': False}

async def main():
    with open('scraper/resultado/falhas_tenis.json', 'r', encoding='utf-8') as f:
        falhas = json.load(f)

    with open('loja/src/data/produtos.json', 'r', encoding='utf-8') as f:
        catalog = json.load(f)

    with open('scraper/resultado/checkpoint_tenis.json', 'r', encoding='utf-8') as f:
        checkpoint = json.load(f)

    tenis_1_3 = [p for p in catalog if p.get('category') == 'Tênis Esportivos' and len(p.get('images', [])) <= 3]
    in_chk = [p for p in tenis_1_3 if p.get('sourceUrl') in checkpoint]

    print("=" * 70)
    print("AUDITORIA COMPLETA DOS PRODUTOS COM 1-3 IMAGENS")
    print("=" * 70)
    print(f"Total de produtos analisados: {len(tenis_1_3)}")
    print(f"  - No Checkpoint (já extraídos): {len(in_chk)}")
    print(f"  - No arquivo de Falhas: {len(falhas)}")

    cookies = {'indexlockcode': '888886', 'indexlockcodeRemember': '888886'}
    sem = asyncio.Semaphore(10)
    async with aiohttp.ClientSession(cookies=cookies) as session:
        print("\n[1/2] Verificando todos os 1.106 produtos de falhas_tenis.json...")
        tasks = [check_album(session, f.get('sourceUrl'), sem) for f in falhas]
        falhas_results = await asyncio.gather(*tasks)

        falhas_with_many = [r for r in falhas_results if r['imgs'] >= 4]
        falhas_with_few = [r for r in falhas_results if 1 <= r['imgs'] <= 3]
        falhas_zero_or_err = [r for r in falhas_results if r['imgs'] == 0]
        falhas_404 = [r for r in falhas_results if r['status'] == 404 or r['empty']]

        print(f"  Resultado dos 1.106 itens com falha durante o scraping:")
        print(f"    - Possuem 4+ fotos agora (foram timeout/rate limit transitório): {len(falhas_with_many)}")
        print(f"    - Possuem apenas 1-3 fotos no Yupoo: {len(falhas_with_few)}")
        print(f"    - Álbum indisponível / 404 / Removido: {len(falhas_404)}")
        print(f"    - Erro de conexão persistente / inacessível: {len(falhas_zero_or_err) - len(falhas_404)}")

        print("\n[2/2] Auditando amostra aleatória de 150 produtos dos 4.507 que estão no Checkpoint...")
        random.seed(123)
        chk_sample = random.sample(in_chk, 150)
        tasks_chk = [check_album(session, p.get('sourceUrl'), sem) for p in chk_sample]
        chk_results = await asyncio.gather(*tasks_chk)

        chk_with_many = [r for r in chk_results if r['imgs'] >= 4]
        chk_with_few = [r for r in chk_results if 1 <= r['imgs'] <= 3]
        chk_404 = [r for r in chk_results if r['status'] == 404 or r['empty']]
        chk_err = [r for r in chk_results if r['imgs'] == 0 and not r['empty']]

        print(f"  Resultado da amostra de 150 itens do Checkpoint:")
        print(f"    - Realmente possuem somente 1-3 fotos no Yupoo: {len(chk_with_few)} ({len(chk_with_few)/150*100:.1f}%)")
        print(f"    - Possuem 4+ fotos (possível discrepância de checkpoint anterior): {len(chk_with_many)} ({len(chk_with_many)/150*100:.1f}%)")
        print(f"    - Álbuns removidos / 404: {len(chk_404)}")
        print(f"    - Inacessíveis: {len(chk_err)}")

        # Salva auditoria em arquivo de relatório temporário em scraper/resultado (sem alterar catálogo)
        audit_summary = {
            'total_1_3': len(tenis_1_3),
            'checkpoint_count': len(in_chk),
            'falhas_count': len(falhas),
            'falhas_detalhes': {
                'possui_fotos_no_yupoo': len(falhas_with_many),
                'possui_1_a_3_fotos': len(falhas_with_few),
                'removidos_ou_404': len(falhas_404),
                'inacessiveis_ou_erro': len(falhas_zero_or_err) - len(falhas_404)
            },
            'amostra_checkpoint_150': {
                'realmente_1_a_3_fotos': len(chk_with_few),
                'pct_realmente_1_a_3': len(chk_with_few) / 150 * 100,
                'possui_4_mais_fotos': len(chk_with_many),
                'pct_possui_4_mais': len(chk_with_many) / 150 * 100
            }
        }
        with open('scraper/resultado/auditoria_1_3.json', 'w', encoding='utf-8') as out:
            json.dump(audit_summary, out, ensure_ascii=False, indent=2)

asyncio.run(main())
