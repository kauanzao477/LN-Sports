import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
from bs4 import BeautifulSoup
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://minkang.x.yupoo.com/'
}

url = 'https://minkang.x.yupoo.com/categories'
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, timeout=15) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

soup = BeautifulSoup(html, 'html.parser')

# Check categories__box-left
left_box = soup.find(class_='categories__box-left')
if left_box:
    print("=== CATEGORIES IN BOX-LEFT ===")
    for a in left_box.find_all('a', href=True):
        print(f"HREF: {a['href']} | TEXT: {a.get_text(strip=True)}")

# Check showheader category items
header_items = soup.find_all('li', class_=re.compile(r'showheader__category_item|showheader_item'))
print(f"\n=== HEADER ITEMS COUNT: {len(header_items)} ===")
for item in header_items:
    a = item.find('a', href=True)
    if a:
        print(f"HEADER: {a['href']} | TEXT: {a.get_text(strip=True)}")

