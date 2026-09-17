import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('loja/src/data/produtos.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

categories = ['Tênis Esportivos', 'Tênis On Running e HOKA', 'Camisetas de Time', 'Camisetas de Time Retrô']

for cat in categories:
    prods = [p for p in catalog if p.get('category') == cat]
    print(f"\n=======================================================")
    print(f"CATEGORIA: {cat} (Total: {len(prods):,})")
    print(f"=======================================================")
    for p in prods[:3]:
        imgs = p.get('images', [])
        print(f"\nProduto: {p.get('name')}")
        print(f"Total Imagens: {len(imgs)}")
        for idx, img in enumerate(imgs[:6]):
            print(f"  [{idx}] {img}")
