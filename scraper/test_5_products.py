import json
import re
import sys
import urllib.parse
import requests

sys.stdout.reconfigure(encoding='utf-8')

COOKIE = 'indexlockcode=888886; indexlockcodeRemember=888886'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://aj-dongli.x.yupoo.com/',
    'Cookie': COOKIE
}

# Read 5 real products from category "Tênis Esportivos"
with open('loja/src/data/produtos.json', 'r', encoding='utf-8') as f:
    products = json.load(f)

tenis_sample = [p for p in products if p.get('category') == 'Tênis Esportivos'][:5]

print("=" * 70)
print("TESTE DE EXTRAÇÃO YUPOO COM 5 PRODUTOS REAIS (TÊNIS ESPORTIVOS)")
print("SENHA / COOKIE: indexlockcode=888886; indexlockcodeRemember=888886")
print("=" * 70)

for idx, p in enumerate(tenis_sample, 1):
    source_url = p.get('sourceUrl', '')
    current_images = p.get('images', [])
    print(f"\n--- PRODUTO #{idx} ---")
    print(f"Nome: {p.get('name')}")
    print(f"source_url: {source_url}")
    print(f"Quantidade atual de imagens: {len(current_images)}")
    print(f"Imagens atuais:")
    for ci in current_images:
        print(f"  [ATUAL] {ci}")

    # Fetch Yupoo album
    try:
        resp = requests.get(source_url, headers=HEADERS, timeout=20)
        if resp.status_code != 200:
            print(f"ERRO HTTP: status {resp.status_code}")
            continue

        html = resp.text

        # Inspeciona contêineres de imagem (.image__main ou .showalbum__children)
        containers = re.findall(
            r'<div[^>]+class="[^"]*(?:image__main|showalbum__children)[^"]*"[^>]*>.*?<img[^>]+>',
            html,
            re.DOTALL
        )

        extracted_images = []
        seen_urls = set()
        seen_hashes = set()

        for c in containers:
            # Atributos em ordem de prioridade: data-origin-src > data-src > src
            m_origin = re.search(r'data-origin-src=["\']([^"\']+)["\']', c)
            m_src = re.search(r'data-src=["\']([^"\']+)["\']', c)
            m_fallback = re.search(r'src=["\']([^"\']+)["\']', c)

            chosen = None
            if m_origin and m_origin.group(1):
                chosen = m_origin.group(1)
            elif m_src and m_src.group(1):
                chosen = m_src.group(1)
            elif m_fallback and m_fallback.group(1):
                raw_src = m_fallback.group(1)
                # Ignora thumbnail pequena se for explicitamente small.jpg
                if '/small.' not in raw_src:
                    chosen = raw_src

            if chosen:
                if chosen.startswith('//'):
                    chosen = 'https:' + chosen
                elif chosen.startswith('/'):
                    chosen = urllib.parse.urljoin(source_url, chosen)

                # Identifica hash da foto (ex: photo.yupoo.com/user/hash/...)
                hash_match = re.search(r'photo\.yupoo\.com/[^/]+/([a-f0-9]+)/', chosen)
                photo_hash = hash_match.group(1) if hash_match else chosen

                if photo_hash not in seen_hashes and chosen not in seen_urls:
                    seen_hashes.add(photo_hash)
                    seen_urls.add(chosen)
                    extracted_images.append(chosen)

        # Fallback se os contêineres não foram encontrados
        if not extracted_images:
            raw_photos = re.findall(r'(https?://photo\.yupoo\.com/[^/]+/[a-f0-9]+/[^\s"\'<>]+\.jpg)', html)
            for raw_u in raw_photos:
                if '/small.' in raw_u or '/medium.' in raw_u:
                    continue
                hash_match = re.search(r'photo\.yupoo\.com/[^/]+/([a-f0-9]+)/', raw_u)
                photo_hash = hash_match.group(1) if hash_match else raw_u
                if photo_hash not in seen_hashes:
                    seen_hashes.add(photo_hash)
                    extracted_images.append(raw_u)

        print(f"Quantidade encontrada no Yupoo: {len(extracted_images)} imagens")
        has_duplicates = len(extracted_images) != len(set(extracted_images))
        print(f"Duplicatas detectadas: {'SIM' if has_duplicates else 'NÃO (100% únicas)'}")
        print("URLs/imagens recuperadas:")
        for i, img in enumerate(extracted_images, 1):
            print(f"  {i:2d}. {img}")

    except Exception as e:
        print(f"ERRO ao processar produto #{idx}: {e}")

print("\n" + "=" * 70)
print("TESTE DE LEITURA CONCLUÍDO. NENHUM UPDATE FOI REALIZADO.")
print("=" * 70)
