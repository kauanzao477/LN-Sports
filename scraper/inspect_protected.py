import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
from bs4 import BeautifulSoup

url = "https://1998shoe.x.yupoo.com/categories"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://1998shoe.x.yupoo.com/'})
with urllib.request.urlopen(req, timeout=10) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

soup = BeautifulSoup(html, 'html.parser')
print("TITLE:", soup.title.string if soup.title else "")
print("BODY TEXT:")
print(soup.get_text()[:1000])
