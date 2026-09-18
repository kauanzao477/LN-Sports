import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
import re

url = "https://s.yupoo.com/website/4.33.6/common.js?edda5a6178c1fb170c31"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=10) as resp:
    js = resp.read().decode('utf-8', errors='ignore')

# Search for what happens after indexlock__ok or fetch/ajax/post
idx = js.find('#indexlock__ok')
if idx != -1:
    snippet = js[idx:idx+2500]
    print("CODE AFTER #indexlock__ok:")
    print(snippet)
