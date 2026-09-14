import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
from bs4 import BeautifulSoup
import re

sources = [
    ("Catálogo de Chuteiras - 01", "https://lvguccinike.x.yupoo.com/categories"),
    ("Catálogo de Chuteiras - 02", "https://ywq2000.x.yupoo.com/categories"),
    ("Catálogo de Chuteiras - 03", "https://dachang88.x.yupoo.com/categories"),
    ("Catálogo de Chuteiras - Infantil", "https://mzrycm102618.x.yupoo.com/categories/4742786"),
    ("Sapatilhas de Atletismo", "https://mzrycm102618.x.yupoo.com/search/album?uid=1&sort=unix&q=Maxfly"),
    ("Camisetas de Time Retrô", "https://minkang.x.yupoo.com/categories/711624"),
    ("Camisetas de Time", "https://minkang.x.yupoo.com/categories"),
    ("Tênis On Running e HOKA", "https://x.yupoo.com/photos/sdh60889/albums"),
    ("Tênis Casuais - Senha: HJH001077", "https://1998shoe.x.yupoo.com/"),
    ("Tênis Esportivos - Senha: 888888", "https://aj-dongli.x.yupoo.com/albums")
]

print(f"Testando {len(sources)} fontes...")

for name, url in sources:
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': url
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            html = resp.read().decode('utf-8', errors='ignore')
        
        soup = BeautifulSoup(html, 'html.parser')
        title = soup.title.string.strip() if soup.title and soup.title.string else "Sem título"
        
        # Encontra álbuns
        albums = set(re.findall(r'/albums/\d+', html))
        categories = set(re.findall(r'/categories/\d+', html))
        has_password = "password" in html.lower() or "senha" in html.lower() or "input-password" in html.lower()
        
        print(f"\n[OK] {name}")
        print(f"     URL: {url}")
        print(f"     Status: HTTP {status} | Título: {title[:40]}")
        print(f"     Álbuns na página: {len(albums)} | Categorias na página: {len(categories)} | Requer senha: {has_password}")
        if albums:
            first_album = list(albums)[0]
            print(f"     Exemplo álbum: {first_album}")
    except Exception as e:
        print(f"\n[ERRO] {name}")
        print(f"       URL: {url}")
        print(f"       Erro: {e}")

