import requests

test_url = 'https://photo.yupoo.com/aj-dongli/5dd477305a/eee41de3.jpg'
headers = {'Referer': 'https://aj-dongli.x.yupoo.com/'}

for variant in ['full', 'small.jpg', 'medium.jpg', 'square.jpg']:
    if variant == 'full':
        u = test_url
    else:
        u = test_url.rsplit('/', 1)[0] + '/' + variant
    r = requests.head(u, headers=headers)
    print(f"Variant '{variant}': Status {r.status_code}, Length: {r.headers.get('Content-Length')}")
