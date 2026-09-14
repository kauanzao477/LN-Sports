import json
import sys
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')
p = r'C:/Users/kauan/Downloads/LN-Sports/loja/src/data/produtos.json'
with open(p, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total de produtos em {p}: {len(data)}")
cats = Counter(item.get('category') for item in data)
print("\nDistribuição por categoria:")
for cat, count in cats.most_common():
    print(f"  {cat}: {count} produtos")

print("\nÚltimos 5 produtos adicionados:")
for item in data[-5:]:
    print(f"  [{item.get('category')}] {item.get('name')} | Imagens: {len(item.get('images', []))}")
