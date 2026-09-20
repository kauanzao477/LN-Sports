import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
from bs4 import BeautifulSoup
import re

url = "https://sdh60889.x.yupoo.com/albums/251777565?uid=1"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://sdh60889.x.yupoo.com/'
}
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, timeout=10) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

soup = BeautifulSoup(html, 'html.parser')
title = soup.title.string.strip() if soup.title else ""
img_tags = soup.find_all('div', class_=re.compile(r'image__main|showalbum__children'))
print("ÁLBUM TESTADO:", title)
print("Contêineres de imagem encontrados:", len(img_tags))
images = []
for div in img_tags:
    img = div.find('img')
    if img:
        src = img.get('data-origin-src') or img.get('data-src') or img.get('src')
        if src:
            images.append(src)
print(f"Total fotos extraídas: {len(images)}")
for u in images[:5]:
    print("  Foto:", u)

