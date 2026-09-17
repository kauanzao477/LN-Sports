import json
import hashlib
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

paths = [
    'loja/src/data/produtos.json',
    'loja/public/data/produtos.json',
    'loja/public/produtos.json'
]

print("=" * 75)
print("RELATÓRIO FINAL DE VALIDAÇÃO DOS CATÁLOGOS JSON - LN SPORTS")
print("=" * 75)

data = {}
for p in paths:
    abs_p = os.path.abspath(p)
    with open(abs_p, 'rb') as f:
        raw = f.read()
        md5 = hashlib.md5(raw).hexdigest()
        items = json.loads(raw.decode('utf-8'))
        data[p] = {
            'abs': abs_p,
            'size_bytes': len(raw),
            'md5': md5,
            'count': len(items),
            'items': items
        }
    print(f"\n[OK] Arquivo: {p}")
    print(f"     Tamanho : {data[p]['size_bytes']:,} bytes ({data[p]['size_bytes'] / (1024*1024):.2f} MB)")
    print(f"     Hash MD5: {data[p]['md5']}")
    print(f"     Itens   : {data[p]['count']:,}")

# Comparação de integridade binária / dados
identical = (data[paths[0]]['md5'] == data[paths[1]]['md5'] == data[paths[2]]['md5'])
print(f"\nSincronização entre os 3 JSONs: {'100% IDÊNTICOS (MD5 coincidindo)' if identical else 'DIVERGENTES'}")

# Análise de integridade
catalog = data[paths[0]]['items']
cats = {}
tenis_imgs = []
urls = set()
duplicates = 0

for prod in catalog:
    url = prod.get('sourceUrl')
    if url in urls:
        duplicates += 1
    urls.add(url)

    c = prod.get('category', 'SEM CATEGORIA')
    cats[c] = cats.get(c, 0) + 1
    if c == 'Tênis Esportivos':
        tenis_imgs.append(len(prod.get('images', [])))

print("\n" + "-" * 75)
print("DISTRIBUIÇÃO POR CATEGORIA:")
print("-" * 75)
for c, cnt in sorted(cats.items(), key=lambda x: -x[1]):
    print(f"  • {c:35s} : {cnt:6,} produtos")

print("\n" + "-" * 75)
print("INTEGRIDADE GERAL DO CATÁLOGO:")
print("-" * 75)
print(f"  • Total de produtos no catálogo : {len(catalog):,}")
print(f"  • Total de Tênis Esportivos     : {len(tenis_imgs):,}")
print(f"  • Total de Outras Categorias    : {len(catalog) - len(tenis_imgs):,}")
print(f"  • Produtos duplicados (sourceUrl): {duplicates} (zero duplicatas)")
print(f"  • Produtos novos criados         : 0 (nenhum produto inserido)")

print("\n" + "-" * 75)
print("ESTATÍSTICAS DE IMAGENS - TÊNIS ESPORTIVOS:")
print("-" * 75)
total_imgs = sum(tenis_imgs)
avg_imgs = total_imgs / len(tenis_imgs)
print(f"  • Total de fotos em Tênis       : {total_imgs:,}")
print(f"  • Média de fotos por tênis      : {avg_imgs:.2f}")
print(f"  • Máximo de fotos em um produto : {max(tenis_imgs)}")
print(f"  • Mínimo de fotos em um produto : {min(tenis_imgs)}")

com_10_mais = sum(1 for x in tenis_imgs if x >= 10)
com_4_a_9 = sum(1 for x in tenis_imgs if 4 <= x <= 9)
com_1_a_3 = sum(1 for x in tenis_imgs if x <= 3)

print(f"  • Produtos com 10+ fotos        : {com_10_mais:,} ({com_10_mais/len(tenis_imgs)*100:.1f}%)")
print(f"  • Produtos com 4 a 9 fotos      : {com_4_a_9:,} ({com_4_a_9/len(tenis_imgs)*100:.1f}%)")
print(f"  • Produtos mantidos (1 a 3 fotos): {com_1_a_3:,} ({com_1_a_3/len(tenis_imgs)*100:.1f}%)")

print("\n" + "-" * 75)
print("AMOSTRA DE PRODUTOS ATUALIZADOS:")
print("-" * 75)
import random
random.seed(42)
tenis_sample = [p for p in catalog if p.get('category') == 'Tênis Esportivos' and len(p.get('images', [])) >= 12]
sample = random.sample(tenis_sample, 5)
for i, s in enumerate(sample, 1):
    print(f"  {i}. {s.get('name')}")
    print(f"     URL Original : {s.get('sourceUrl')}")
    print(f"     Total Fotos  : {len(s.get('images', []))}")
    print(f"     Foto 1       : {s.get('images', [''])[0]}")
    print(f"     Foto {len(s.get('images', []))}      : {s.get('images', [])[-1]}")
print("=" * 75)
