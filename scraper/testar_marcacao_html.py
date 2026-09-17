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

async def inspect_album_html(url):
    headers = dict(DEFAULT_HEADERS)
    headers['Cookie'] = YUPOO_COOKIE
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as resp:
            if resp.status == 200:
                html = await resp.text(encoding='utf-8', errors='ignore')
                print(f"URL: {url}")
                # Encontra tags img ou container de imagem
                imgs = re.findall(r'<div[^>]+class="[^"]*image__main[^"]*"[^>]*>.*?</div>', html, re.DOTALL)
                print(f"Encontrados {len(imgs)} containers image__main")
                for i, c in enumerate(imgs[:5]):
                    print(f"--- Container [{i}] ---")
                    print(c[:300].strip())
            else:
                print(f"HTTP {resp.status} para {url}")

with open('loja/src/data/produtos.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

# Pega 1 produto de cada categoria
for cat in ['Tênis Esportivos', 'Tênis On Running e HOKA', 'Camisetas de Time', 'Camisetas de Time Retrô']:
    p = next(x for x in catalog if x.get('category') == cat and x.get('sourceUrl'))
    print(f"\n==================== {cat} ====================")
    asyncio.run(inspect_album_html(p.get('sourceUrl')))
