import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
from bs4 import BeautifulSoup

url = "https://1998shoe.x.yupoo.com/categories"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://1998shoe.x.yupoo.com/'})
with urllib.request.urlopen(req, timeout=10) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

soup = BeautifulSoup(html, 'html.parser')
# Find elements with password
pwd_div = soup.find(lambda el: el.string and '主页已加密' in el.string)
if pwd_div:
    parent = pwd_div.find_parent('div', class_=True)
    print("PARENT OF PWD:", parent)
else:
    # search html for class or id with password
    for el in soup.find_all(attrs={'class': True}):
        if any('pass' in c.lower() or 'encrypt' in c.lower() or 'lock' in c.lower() for c in el.get('class')):
            print("CLASS MATCH:", el.name, el.get('class'), el.get('id'))
            print("Snippet:", str(el)[:300])

for form in soup.find_all('form'):
    print("FORM:", form)
