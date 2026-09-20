import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
import re

url = "https://aj-dongli.x.yupoo.com/categories"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://aj-dongli.x.yupoo.com/',
    'Cookie': 'indexlockcode=888886; indexlockcodeRemember=888886'
}
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, timeout=10) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

albums = set(re.findall(r'/albums/\d+', html))
cats = set(re.findall(r'/categories/\d+', html))
print(f"aj-dongli /categories COM COOKIE -> Álbuns: {len(albums)}, Categorias: {len(cats)}")
if cats:
    print("  Categorias encontradas:", list(cats)[:5])
