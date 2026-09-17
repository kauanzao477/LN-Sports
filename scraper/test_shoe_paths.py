import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
from bs4 import BeautifulSoup
import re

for base in ["https://1998shoe.x.yupoo.com", "https://aj-dongli.x.yupoo.com"]:
    for path in ["/categories", "/albums"]:
        url = f"{base}{path}"
        headers = {'User-Agent': 'Mozilla/5.0', 'Referer': base}
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                html = resp.read().decode('utf-8', errors='ignore')
            albums = set(re.findall(r'/albums/\d+', html))
            cats = set(re.findall(r'/categories/\d+', html))
            print(f"{url} -> Álbuns: {len(albums)}, Categorias: {len(cats)}")
        except Exception as e:
            print(f"{url} -> Erro: {e}")

