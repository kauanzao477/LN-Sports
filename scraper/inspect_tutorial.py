import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
from bs4 import BeautifulSoup
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://minkang.x.yupoo.com/'
}

url = 'https://minkang.x.yupoo.com/categories/3296718'
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
    soup = BeautifulSoup(html, 'html.parser')
    print("PAGE TITLE:", soup.title.string if soup.title else "")
    for a in soup.find_all('a', href=True):
        if '/albums/' in a['href']:
            print("ALBUM:", a['href'], a.get_text(strip=True))
except Exception as e:
    print("Error:", e)
