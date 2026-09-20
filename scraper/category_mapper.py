# -*- coding: utf-8 -*-
"""
category_mapper.py — Mapeador Oficial de Categorias LN-SPORTS.

Garante que todos os produtos extraídos pelo scraper Yupoo sejam associados
a uma das 11 categorias oficiais exigidas para a loja:

1. Camisetas de Time Retrô
2. Sapatilhas de Atletismo
3. Catálogo de Chuteiras - 01
4. Catálogo de Chuteiras - 02
5. Catálogo de Chuteiras - 03
6. Catálogo de Chuteiras - Infantil
7. Tabela de Conversão BR x EUR
8. Camisetas de Time
9. Tênis On Running e HOKA
10. Tênis Casuais - Senha: HJH001077
11. Tênis Esportivos - Senha: 888886
"""

OFFICIAL_CATEGORIES = [
    "Camisetas de Time Retrô",
    "Sapatilhas de Atletismo",
    "Catálogo de Chuteiras - 01",
    "Catálogo de Chuteiras - 02",
    "Catálogo de Chuteiras - 03",
    "Catálogo de Chuteiras - Infantil",
    "Tabela de Conversão BR x EUR",
    "Camisetas de Time",
    "Tênis de Corrida",
    "Tênis Esportivo",
    "Tênis On Running e HOKA",
    "Tênis Casuais - Senha: HJH001077",
    "Tênis Esportivos - Senha: 888886",
]

# -*- coding: utf-8 -*-
"""
category_mapper.py — Mapeador Oficial de Categorias LN-SPORTS.

Garante que cada produto receba SOMENTE a categoria correspondente à fonte/categoria
do Yupoo de onde foi coletado, sem categoria global padrão e sem duplicatas.
"""

OFFICIAL_CATEGORIES = [
    "Camisetas de Time Retrô",
    "Sapatilhas de Atletismo",
    "Catálogo de Chuteiras - 01",
    "Catálogo de Chuteiras - 02",
    "Catálogo de Chuteiras - 03",
    "Catálogo de Chuteiras - Infantil",
    "Tabela de Conversão BR x EUR",
    "Camisetas de Time",
    "Tênis de Corrida",
    "Tênis Esportivo",
    "Tênis On Running e HOKA",
    "Tênis Casuais - Senha: HJH001077",
    "Tênis Esportivos - Senha: 888886",
]

def map_category(raw_name: str = "", album_url: str = "", source_link: str = "") -> str:
    """
    Mapeia de forma estrita e determinística cada produto para a categoria exata da sua fonte.
    Prioridade:
    1. Categoria oficial configurada para a fonte de entrada (links.txt).
    2. Domínio e estrutura da URL do álbum.
    3. Metadados do álbum / título.
    """
    src_lower = str(source_link).lower().strip() if source_link else ""
    url_lower = str(album_url).lower().strip() if album_url else ""
    n = str(raw_name).lower().strip() if raw_name else ""

    # 1. Mapeamento por link de origem (links.txt)
    if src_lower:
        if 'lvguccinike.x.yupoo.com' in src_lower:
            return "Catálogo de Chuteiras - 01"
        if 'ywq2000.x.yupoo.com' in src_lower:
            return "Catálogo de Chuteiras - 02"
        if 'dachang88.x.yupoo.com' in src_lower:
            return "Catálogo de Chuteiras - 03"
        if 'mzrycm102618.x.yupoo.com' in src_lower:
            if '4742786' in src_lower or any(k in n for k in ['童鞋', 'infantil', 'kid', 'junior']):
                return "Catálogo de Chuteiras - Infantil"
            if 'maxfly' in src_lower or any(k in n for k in ['maxfly', '钉鞋', 'sapatilha', 'spikes', 'atletismo']):
                return "Sapatilhas de Atletismo"
            return "Catálogo de Chuteiras - Infantil"
        if 'sdh60889' in src_lower:
            return "Tênis On Running e HOKA"
        if '1998shoe' in src_lower:
            return "Tênis Casuais - Senha: HJH001077"
        if 'aj-dongli' in src_lower:
            return "Tênis Esportivos - Senha: 888886"
        if 'minkang' in src_lower:
            if '711624' in src_lower or any(k in n for k in ['711624', 'retro', 'retrô']):
                return "Camisetas de Time Retrô"
            if '3436273' in src_lower or any(k in n for k in ['3436273', 'sizes', 'tabela', 'convers']):
                return "Tabela de Conversão BR x EUR"
            if any(k in n for k in ['retro', 'retrô']):
                return "Camisetas de Time Retrô"
            return "Camisetas de Time"

    # 2. Mapeamento por URL do álbum
    if 'lvguccinike.x.yupoo.com' in url_lower:
        return "Catálogo de Chuteiras - 01"
    if 'ywq2000.x.yupoo.com' in url_lower:
        return "Catálogo de Chuteiras - 02"
    if 'dachang88.x.yupoo.com' in url_lower:
        return "Catálogo de Chuteiras - 03"
    if 'sdh60889' in url_lower:
        return "Tênis On Running e HOKA"
    if '1998shoe' in url_lower:
        return "Tênis Casuais - Senha: HJH001077"
    if 'aj-dongli' in url_lower:
        return "Tênis Esportivos - Senha: 888886"
    if 'mzrycm102618' in url_lower:
        if '4742786' in url_lower or any(k in n for k in ['童鞋', 'infantil', 'kid', 'junior']):
            return "Catálogo de Chuteiras - Infantil"
        if 'maxfly' in url_lower or any(k in n for k in ['maxfly', '钉鞋', 'sapatilha', 'spikes', 'atletismo']):
            return "Sapatilhas de Atletismo"
        if any(k in n for k in ['boot', 'chuteira', 'cleat', 'fg', 'tf', 'f50', 'predator', 'mercurial']):
            return "Catálogo de Chuteiras - Infantil"
        return "Sapatilhas de Atletismo"
    if 'minkang' in url_lower:
        if '711624' in url_lower or any(k in n for k in ['711624', 'retro', 'retrô']):
            return "Camisetas de Time Retrô"
        if '3436273' in url_lower or any(k in n for k in ['3436273', 'sizes', 'tabela', 'convers']):
            return "Tabela de Conversão BR x EUR"
        if any(k in n for k in ['retro', 'retrô']):
            return "Camisetas de Time Retrô"
        return "Camisetas de Time"

    # 3. Mapeamentos exatos de nomes
    exact_map = {
        "camisetas de time retrô": "Camisetas de Time Retrô",
        "camisetas de time retro": "Camisetas de Time Retrô",
        "sapatilhas de atletismo": "Sapatilhas de Atletismo",
        "catálogo de chuteiras - 01": "Catálogo de Chuteiras - 01",
        "catalogo de chuteiras - 01": "Catálogo de Chuteiras - 01",
        "catálogo de chuteiras - 02": "Catálogo de Chuteiras - 02",
        "catalogo de chuteiras - 02": "Catálogo de Chuteiras - 02",
        "catálogo de chuteiras - 03": "Catálogo de Chuteiras - 03",
        "catalogo de chuteiras - 03": "Catálogo de Chuteiras - 03",
        "catálogo de chuteiras - infantil": "Catálogo de Chuteiras - Infantil",
        "catalogo de chuteiras - infantil": "Catálogo de Chuteiras - Infantil",
        "tabela de conversão br x eur": "Tabela de Conversão BR x EUR",
        "tabela de conversao br x eur": "Tabela de Conversão BR x EUR",
        "camisetas de time": "Camisetas de Time",
        "tênis on running e hoka": "Tênis On Running e HOKA",
        "tenis on running e hoka": "Tênis On Running e HOKA",
        "tênis casuais - senha: hjh001077": "Tênis Casuais - Senha: HJH001077",
        "tenis casuais - senha: hjh001077": "Tênis Casuais - Senha: HJH001077",
        "tênis esportivos - senha: 888888": "Tênis Esportivos - Senha: 888886",
        "tenis esportivos - senha: 888888": "Tênis Esportivos - Senha: 888886",
        "tênis esportivos - senha: 888886": "Tênis Esportivos - Senha: 888886",
        "tenis esportivos - senha: 888886": "Tênis Esportivos - Senha: 888886",
        "tênis de corrida": "Tênis de Corrida",
        "tenis de corrida": "Tênis de Corrida",
        "tênis esportivo": "Tênis Esportivo",
        "tenis esportivo": "Tênis Esportivo",
    }
    if n in exact_map:
        return exact_map[n]

    # 4. Palavras-chave contextuais
    if any(k in n for k in ["sapatilha", "maxfly", "spikes", "track & field", "钉鞋"]):
        return "Sapatilhas de Atletismo"
    if any(k in n for k in ["on running", "hoka", "cloudmonster", "clifton", "bondi"]):
        return "Tênis On Running e HOKA"
    if any(k in n for k in ["infantil", "kid", "junior", "童鞋"]) and any(k in n for k in ["chuteira", "cleat", "f50", "predator", "mercurial"]):
        return "Catálogo de Chuteiras - Infantil"
    if any(k in n for k in ["chuteira", "cleat", "football boot", "boots", "mercurial", "predator", "phantom", "tiempo"]):
        return "Catálogo de Chuteiras - 01"
    if any(k in n for k in ["conversão", "conversao", "br x eur", "tabela de medidas"]):
        return "Tabela de Conversão BR x EUR"
    if "retro" in n or "retrô" in n:
        return "Camisetas de Time Retrô"

    # Se nada coincidir, retorna a categoria informada originalmente
    return raw_name.strip() if raw_name else "Camisetas de Time"
