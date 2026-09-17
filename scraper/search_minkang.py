import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
from bs4 import BeautifulSoup
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://minkang.x.yupoo.com/'
}

# 1. Search minkang for shoes/cleats
terms = ['cleat', 'chuteira', 'shoe', 'shoes', 'hoka', 'spike', 'running', 'casual']
for t in terms:
    url = f'https://minkang.x.yupoo.com/search/album?q={t}'
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
        albums = re.findall(r'/albums/\d+', html)
        print(f"Search for '{t}': {len(set(albums))} albums found")
    except Exception as e:
        print(f"Search for '{t}' error: {e}")

# 2. Check all 41 categories on minkang:
# What are all 41 categories and their album counts?
url = 'https://minkang.x.yupoo.com/categories'
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, timeout=15) as resp:
    html = resp.read().decode('utf-8', errors='ignore')
soup = BeautifulSoup(html, 'html.parser')

left_box = soup.find(class_='categories__box-left')
if left_box:
    for a in left_box.find_all('a', href=True):
        href = a['href']
        name = a.get_text(strip=True)
        if any(k in name.lower() for k in ['cleat', 'boot', 'shoe', 'tenis', 'tênis', 'spike', 'sapatilha', 'running', 'hoka', 'senha', 'casual']):
            print("MATCH IN CATEGORIES:", href, "=>", name)

