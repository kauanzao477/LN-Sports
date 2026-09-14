import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
import urllib.parse
import http.cookiejar
from bs4 import BeautifulSoup
import re

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

# Testa login/senha em 1998shoe (senha: HJH001077)
url = "https://1998shoe.x.yupoo.com/"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': url
}

req = urllib.request.Request(url, headers=headers)
with opener.open(req, timeout=10) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

print("Cookies antes:", [c.name for c in cj])

# Procura form de senha
soup = BeautifulSoup(html, 'html.parser')
form = soup.find('form')
if form:
    print("Form action:", form.get('action'))
    print("Form inputs:", [(i.get('name'), i.get('type'), i.get('value')) for i in form.find_all('input')])

# Yupoo password submission endpoint: usually POST to /password or similar
# Let's inspect scripts in html
for s in soup.find_all('script'):
    if 'password' in str(s):
        print("Script with password:", str(s)[:300])

