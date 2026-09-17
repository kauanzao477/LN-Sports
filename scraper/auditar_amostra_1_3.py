import asyncio
import aiohttp
import json
import re
import sys
import urllib.parse

sys.stdout.reconfigure(encoding='utf-8')

YUPOO_COOKIE = 'indexlockcode=888886; indexlockcodeRemember=888886'
DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
}

from recover_tenis_images import extract_images_from_html

async def test_url(session, url):
    headers = dict(DEFAULT_HEADERS)
    parsed = urllib.parse.urlparse(url)
    headers['Referer'] = f"{parsed.scheme}://{parsed.netloc}/"
    headers['Cookie'] = YUPOO_COOKIE
    try:
        async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            status = resp.status
            if status == 200:
                html = await resp.text(encoding='utf-8', errors='ignore')
                imgs = extract_images_from_html(html, url)
                has_pw = 'indexlock' in html.lower() and not ('image__main' in html or 'showalbum__children' in html)
                is_404_page = 'album not found' in html.lower() or 'not exist' in html.lower()
                return {
                    'status': 200,
                    'img_count': len(imgs),
                    'has_pw': has_pw,
                    'is_404_page': is_404_page,
                    'title': re.search(r'<title>(.*?)</title>', html, re.I).group(1) if re.search(r'<title>(.*?)</title>', html, re.I) else ''
                }
            else:
                return {'status': status, 'img_count': 0, 'has_pw': False, 'is_404_page': status == 404, 'title': ''}
    except Exception as e:
        return {'status': f'ERR: {type(e).__name__}', 'img_count': 0, 'has_pw': False, 'is_404_page': False, 'title': ''}

async def main():
    with open('loja/src/data/produtos.json', 'r', encoding='utf-8') as f:
        catalog = json.load(f)

    with open('scraper/resultado/checkpoint_tenis.json', 'r', encoding='utf-8') as f:
        checkpoint = json.load(f)

    with open('scraper/resultado/falhas_tenis.json', 'r', encoding='utf-8') as f:
        falhas = json.load(f)

    tenis_1_3 = [p for p in catalog if p.get('category') == 'Tênis Esportivos' and len(p.get('images', [])) <= 3]
    falhas_urls = {f.get('sourceUrl') for f in falhas if f.get('sourceUrl')}

    in_chk_1_3 = [p for p in tenis_1_3 if p.get('sourceUrl') in checkpoint]
    in_falhas_1_3 = [p for p in tenis_1_3 if p.get('sourceUrl') in falhas_urls]

    print(f"Total 1-3 imagens: {len(tenis_1_3)}")
    print(f"  - No checkpoint: {len(in_chk_1_3)}")
    print(f"  - Em falhas: {len(in_falhas_1_3)}")

    cookies = {'indexlockcode': '888886', 'indexlockcodeRemember': '888886'}
    connector = aiohttp.TCPConnector(limit=5)
    async with aiohttp.ClientSession(connector=connector, cookies=cookies) as session:
        print("\n--- TESTANDO AMOSTRA DO CHECKPOINT COM 1-2 IMAGENS (15 PRODUTOS) ---")
        for p in in_chk_1_3[:15]:
            url = p.get('sourceUrl')
            res = await test_url(session, url)
            print(f"Prod: {p.get('name')[:40]}...")
            print(f"  URL: {url}")
            print(f"  Catalog: {len(p.get('images', []))} imgs | Yupoo agora: Status {res['status']} | Imgs extraídas: {res['img_count']} | Senha?: {res['has_pw']} | 404?: {res['is_404_page']}")

        print("\n--- TESTANDO AMOSTRA DE FALHAS (15 PRODUTOS) ---")
        for p in in_falhas_1_3[:15]:
            url = p.get('sourceUrl')
            res = await test_url(session, url)
            print(f"Prod: {p.get('name')[:40]}...")
            print(f"  URL: {url}")
            print(f"  Catalog: {len(p.get('images', []))} imgs | Yupoo agora: Status {res['status']} | Imgs extraídas: {res['img_count']} | Senha?: {res['has_pw']} | 404?: {res['is_404_page']}")

asyncio.run(main())
