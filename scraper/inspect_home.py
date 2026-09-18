import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
from bs4 import BeautifulSoup
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://minkang.x.yupoo.com/'
}

url = 'https://minkang.x.yupoo.com/'
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, timeout=15) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

soup = BeautifulSoup(html, 'html.parser')
print("HOME TITLE:", soup.title.string if soup.title else "")

# Check header / notice / banner
banner = soup.find(class_=re.compile(r'header|notice|banner|announcement|contact|intro', re.I))
if banner:
    print("BANNER / NOTICE TEXT:")
    print(banner.get_text(strip=True)[:1000])

# Find all links on home page
links = soup.find_all('a', href=True)
print(f"Total links on home page: {len(links)}")
for a in links:
    href = a['href']
    t = a.get_text(strip=True)
    if any(k in (t + href).lower() for k in ['chuteira', 'tenis', 'tênis', 'sapatilha', 'senha', 'running', 'hoka', 'hjh', '888888', 'convers']):
        print(f"MATCH: {href} -> {t}")

# Also search entire html text for 888888 or HJH001077 or Chuteira or Atletismo
for line in html.split('\n'):
    if any(k in line.lower() for k in ['888888', 'hjh001077', 'sapatilha', 'chuteira', 'atletismo', 'hoka', 'conversão', 'conversao']):
        print("HTML LINE MATCH:", line.strip()[:200])

