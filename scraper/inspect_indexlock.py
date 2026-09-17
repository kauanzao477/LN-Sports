import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
import re

url = "https://s.yupoo.com/website/4.33.6/common.js?edda5a6178c1fb170c31"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=10) as resp:
    js = resp.read().decode('utf-8', errors='ignore')

# Search for indexlock in common.js
matches = [m.start() for m in re.finditer(r'indexlock', js)]
print(f"Found {len(matches)} occurrences of indexlock in common.js")
for idx in matches[:5]:
    print("--- SNIPPET ---")
    print(js[max(0, idx-100):min(len(js), idx+300)])
