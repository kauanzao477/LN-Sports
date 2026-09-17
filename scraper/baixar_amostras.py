import asyncio
import aiohttp
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('loja/src/data/produtos.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

# Procura produtos que tenham várias imagens
os.makedirs('scraper/amostras_capas', exist_ok=True)

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Referer': 'https://photo.yupoo.com/'
}

async def download_image(session, url, path):
    try:
        async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status == 200:
                content = await resp.read()
                with open(path, 'wb') as f:
                    f.write(content)
                return True
    except Exception as e:
        pass
    return False

async def main():
    async with aiohttp.ClientSession() as session:
        for cat in ['Tênis Esportivos', 'Tênis On Running e HOKA', 'Camisetas de Time', 'Camisetas de Time Retrô']:
            cat_clean = cat.replace(' ', '_').replace('/', '_')
            prods = [p for p in catalog if p.get('category') == cat and len(p.get('images', [])) >= 8]
            sample = prods[:3]
            for p_idx, p in enumerate(sample):
                folder = f'scraper/amostras_capas/{cat_clean}_p{p_idx}'
                os.makedirs(folder, exist_ok=True)
                imgs = p.get('images', [])[:8]
                print(f"\nBaixando {len(imgs)} imagens de: {p.get('name')[:40]} ({cat})")
                for i_idx, img_url in enumerate(imgs):
                    ext = '.jpg'
                    path = f"{folder}/img_{i_idx:02d}{ext}"
                    await download_image(session, img_url, path)
                print(f"  Salvo em {folder}")

asyncio.run(main())
