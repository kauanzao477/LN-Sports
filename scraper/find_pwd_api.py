import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
import re

url = "https://1998shoe.x.yupoo.com/categories"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://1998shoe.x.yupoo.com/'})
with urllib.request.urlopen(req, timeout=10) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

# Search for api or post endpoints in the html
for m in re.finditer(r'/(?:api|password|check|verify|login|auth)[^\s"\'<>]*', html):
    print("MATCH ENDPOINT:", m.group(0))

# Search for inline javascript functions or webpack bundles
bundles = re.findall(r'src="([^"]+\.js[^"]*)"', html)
for b in bundles:
    print("BUNDLE:", b)
