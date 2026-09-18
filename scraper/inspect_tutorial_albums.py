import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
from bs4 import BeautifulSoup

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://minkang.x.yupoo.com/'
}

albums = ['245054522', '245053971', '245052379']
for alb in albums:
    url = f'https://minkang.x.yupoo.com/albums/{alb}?uid=1'
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
    soup = BeautifulSoup(html, 'html.parser')
    title = soup.title.string if soup.title else ""
    text = soup.get_text()
    print(f"\n=== ALBUM {alb}: {title} ===")
    # Print any external links or yupoo links in the text
    import re
    urls = re.findall(r'https?://[^\s<>"\']+', html)
    yupoo_urls = [u for u in set(urls) if 'yupoo.com' in u or 'http' in u]
    for u in yupoo_urls[:20]:
        print("  Found URL:", u)
    for line in text.split('\n'):
        if any(k in line.lower() for k in ['chuteira', 'tenis', 'tênis', 'senha', 'sapatilha', 'catálogo', 'catalogo', 'link', 'whatsapp', '888888', 'hjh001077']):
            print("  TEXT LINE:", line.strip())
