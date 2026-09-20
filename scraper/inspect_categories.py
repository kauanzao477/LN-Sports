import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
import re
from bs4 import BeautifulSoup

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://minkang.x.yupoo.com/'
}

url = 'https://minkang.x.yupoo.com/categories'
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
    
    soup = BeautifulSoup(html, 'html.parser')
    print("PAGE TITLE:", soup.title.string if soup.title else "")
    
    # Check all links containing /categories/
    links = soup.find_all('a', href=True)
    cat_links = []
    for a in links:
        href = a['href']
        if '/categories/' in href or '/category/' in href:
            text = a.get_text(strip=True)
            cat_links.append((href, text))
    
    print(f"Total category links in page: {len(cat_links)}")
    seen = set()
    for href, text in cat_links:
        clean = f"{href} => {text}"
        if clean not in seen:
            seen.add(clean)
            print("  ", clean)

    # Check for categories container classes
    print("\nContainers:")
    for c in soup.find_all(class_=re.compile(r'categor', re.I)):
        print(f"Tag: {c.name}, classes: {c.get('class')}, len: {len(c.get_text(strip=True))}")
except Exception as e:
    print("Error fetching categories:", e)
