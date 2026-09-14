import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
import re

url = "https://aj-dongli.x.yupoo.com/"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=10) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

owner = re.search(r'OWNER\s*=\s*["\']([^"\']+)["\']', html)
api_origin = re.search(r'API_ORIGIN\s*=\s*["\']([^"\']+)["\']', html)
print("OWNER:", owner.group(1) if owner else "not found")
print("API_ORIGIN:", api_origin.group(1) if api_origin else "not found")

if owner and api_origin:
    api_url = f"{api_origin.group(1)}/web/users/{owner.group(1)}?password=888888"
    print("Testing API:", api_url)
    req_api = urllib.request.Request(api_url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': url})
    try:
        with urllib.request.urlopen(req_api, timeout=10) as resp_api:
            print("API RESPONSE:", resp_api.read().decode('utf-8'))
    except Exception as e:
        print("API ERROR:", e)
