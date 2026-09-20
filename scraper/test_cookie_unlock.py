import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
import re

# Test 1: 1998shoe with cookie
url1 = "https://1998shoe.x.yupoo.com/categories"
headers1 = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://1998shoe.x.yupoo.com/',
    'Cookie': 'indexlockcode=HJH001077; indexlockcodeRemember=HJH001077'
}
req1 = urllib.request.Request(url1, headers=headers1)
with urllib.request.urlopen(req1, timeout=10) as resp:
    html1 = resp.read().decode('utf-8', errors='ignore')

albums1 = set(re.findall(r'/albums/\d+', html1))
cats1 = set(re.findall(r'/categories/\d+', html1))
print(f"1998shoe COM COOKIE -> Álbuns: {len(albums1)}, Categorias: {len(cats1)}")
if albums1:
    print("  Primeiro álbum:", list(albums1)[0])

# Test 2: aj-dongli with cookie (password 888886)
url2 = "https://aj-dongli.x.yupoo.com/albums"
headers2 = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://aj-dongli.x.yupoo.com/',
    'Cookie': 'indexlockcode=888886; indexlockcodeRemember=888886'
}
req2 = urllib.request.Request(url2, headers=headers2)
with urllib.request.urlopen(req2, timeout=10) as resp:
    html2 = resp.read().decode('utf-8', errors='ignore')

albums2 = set(re.findall(r'/albums/\d+', html2))
cats2 = set(re.findall(r'/categories/\d+', html2))
print(f"aj-dongli COM COOKIE -> Álbuns: {len(albums2)}, Categorias: {len(cats2)}")
if albums2:
    print("  Primeiro álbum:", list(albums2)[0])

