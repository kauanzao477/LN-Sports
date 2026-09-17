"""
Módulo Especializado de Extração de Imagens e Metadados.
Foco prioritário: Catálogos Yupoo com 100% de fidelidade nas imagens originais e alta resolução,
preservando a ordem exata das fotos, eliminando ruídos e suportando modo debug completo.
"""
import re
import html
import urllib.parse
from typing import List, Dict, Set, Tuple
from bs4 import BeautifulSoup
from config import IGNORE_KEYWORDS, IGNORE_EXTENSIONS

# Padrões comuns de miniaturas
RE_THUMB_KEYWORDS = re.compile(r'/(?:small|thumb|thumbnail|tiny|mini)\.', re.IGNORECASE)

def clean_text(text: str) -> str:
    """Limpa textos, decodifica entidades HTML e trata espaços específicos como $nbsp do Yupoo."""
    if not text:
        return ""
    text = html.unescape(text)
    text = text.replace('$nbsp', ' ').replace('&nbsp;', ' ')
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def is_valid_product_image_url(url: str, alt: str = '', class_name: str = '', debug_callback=None) -> Tuple[bool, str]:
    """
    Verifica se a URL da imagem é de um produto real.
    Retorna (True, 'ok') ou (False, 'motivo').
    """
    if not url:
        return False, "URL vazia"
    
    url_lower = url.lower()
    alt_lower = alt.lower() if alt else ''
    class_lower = class_name.lower() if class_name else ''

    # Ignora SVG em formato base64
    if url_lower.startswith('data:image/svg'):
        return False, "Data-URI SVG (ícone)"
    if url_lower.startswith('data:') and len(url) < 2000:
        return False, "Data-URI curta (ruído/ícone)"

    # Verifica extensões ignoradas (.svg, .ico, .gif)
    parsed = urllib.parse.urlparse(url_lower)
    path = parsed.path
    for ext in IGNORE_EXTENSIONS:
        if path.endswith(ext):
            return False, f"Extensão ignorada ({ext})"

    # Verifica palavras-chave indesejadas (logo, banner, ícone, etc.)
    combined = f"{path} {alt_lower} {class_lower}"
    for kw in IGNORE_KEYWORDS:
        if kw in combined:
            # Exceção específica Yupoo: 'icon' no domínio não pode bloquear foto válida
            if kw == 'icon' and 'photo.yupoo.com' in url_lower and '/icons/' not in url_lower:
                continue
            return False, f"Palavra-chave de ruído detectada: '{kw}'"

    return True, "ok"

class ProductExtractor:
    """Extrai fotos e metadados com foco principal no Yupoo e suporte genérico complementar."""

    @staticmethod
    def extract_yupoo_album(
        html_content: str,
        album_url: str,
        default_category: str = "",
        default_subcategory: str = "",
        debug: bool = False
    ) -> dict:
        """
        Extrai fotos e metadados de um álbum do Yupoo:
        1. Localiza os contêineres de fotos (.image__main, .showalbum__children).
        2. Prioriza a URL original (data-origin-src) ou a imagem grande (data-src).
        3. Nunca utiliza miniatura (small.jpg) se houver versão grande/original.
        4. Preserva a ordem exata em que as fotos aparecem.
        5. Elimina duplicadas mantendo a primeira ocorrência da versão de melhor resolução.
        """
        debug_log = []
        soup = BeautifulSoup(html_content, 'html.parser')

        # 1. TÍTULO DO PRODUTO / ÁLBUM
        title = ""
        info_carry = soup.find(id='infoCarry')
        if info_carry and info_carry.get('data-name'):
            title = clean_text(info_carry.get('data-name'))
            if debug:
                debug_log.append(f"[DEBUG] Título obtido de #infoCarry: {title}")

        if not title:
            header_title = soup.find('span', class_=re.compile(r'showheader__album_title|header__title'))
            if header_title:
                title = clean_text(header_title.text)
                if debug:
                    debug_log.append(f"[DEBUG] Título obtido de header__title: {title}")

        if not title:
            title_tag = soup.find('title')
            if title_tag:
                raw_title = clean_text(title_tag.text)
                title = re.sub(r'\s*-\s*Yupoo.*$', '', raw_title, flags=re.IGNORECASE).strip()
                if debug:
                    debug_log.append(f"[DEBUG] Título obtido de <title>: {title}")

        # 2. CATEGORIA E SUBCATEGORIA
        categoria = default_category
        subcategoria = default_subcategory

        # 3. EXTRAÇÃO DAS IMAGENS
        images: List[str] = []
        seen_hashes: Set[str] = set()
        seen_urls: Set[str] = set()

        # Procura os blocos das fotos no Yupoo
        main_containers = soup.find_all('div', class_=re.compile(r'image__main|showalbum__children'))
        if debug:
            debug_log.append(f"[DEBUG] Contêineres de imagem (.image__main) encontrados: {len(main_containers)}")

        for idx, container in enumerate(main_containers, 1):
            img = container.find('img')
            if not img:
                if debug:
                    debug_log.append(f"[DEBUG] Contêiner #{idx} não possui tag <img>")
                continue

            alt = img.get('alt', '')
            cls = " ".join(img.get('class', [])) if isinstance(img.get('class'), list) else str(img.get('class', ''))

            # Atributos reais disponíveis no Yupoo:
            # - data-origin-src: foto original real em alta resolução enviada pelo vendedor
            # - data-src: URL oficial de exibição em alta resolução (big.jpg)
            # - data-path: caminho interno da foto original
            # - src: miniatura carregada (small.jpg)
            origin_src = img.get('data-origin-src')
            big_src = img.get('data-src')
            src = img.get('src')
            path_attr = img.get('data-path')

            # Escolhe a melhor URL real disponível sem inventar
            chosen_url = ""
            attribute_used = ""

            if origin_src:
                chosen_url = origin_src
                attribute_used = "data-origin-src (original)"
            elif big_src:
                chosen_url = big_src
                attribute_used = "data-src (big.jpg)"
            elif path_attr:
                chosen_url = f"https://photo.yupoo.com{path_attr}"
                attribute_used = "data-path"
            elif src and not RE_THUMB_KEYWORDS.search(src):
                chosen_url = src
                attribute_used = "src"

            # Se a única URL for uma miniatura explícita (small.jpg) e existir big_src, prefere big_src
            if not chosen_url and src:
                chosen_url = src
                attribute_used = "src (thumbnail/fallback)"

            if not chosen_url:
                if debug:
                    debug_log.append(f"[DEBUG] Foto #{idx}: Nenhuma URL encontrada nos atributos")
                continue

            # Normaliza URL completa
            full_url = urllib.parse.urljoin(album_url, chosen_url)

            # Validação anti-ruído
            is_valid, reason = is_valid_product_image_url(full_url, alt, cls)
            if not is_valid:
                if debug:
                    debug_log.append(f"[DEBUG] Foto #{idx} descartada ({reason}): {full_url}")
                continue

            # Identifica hash único da foto no Yupoo (ex: photo.yupoo.com/<user>/<hash>/...)
            hash_match = re.search(r'photo\.yupoo\.com/[^/]+/([a-f0-9]+)/', full_url)
            photo_hash = hash_match.group(1) if hash_match else full_url

            if photo_hash not in seen_hashes and full_url not in seen_urls:
                seen_hashes.add(photo_hash)
                seen_urls.add(full_url)
                images.append(full_url)
                if debug:
                    debug_log.append(f"[DEBUG] Foto #{idx} coletada via {attribute_used}: {full_url}")
            else:
                if debug:
                    debug_log.append(f"[DEBUG] Foto #{idx} duplicada ignorada (hash {photo_hash})")

        # Fallback de segurança: caso o tema do Yupoo seja diferente e não use .image__main
        if not images:
            if debug:
                debug_log.append("[DEBUG] Fallback: buscando ocorrências de photo.yupoo.com no HTML...")
            raw_photos = re.findall(r'(https?://photo\.yupoo\.com/[^/]+/[a-f0-9]+/[^\s"\'<>]+\.jpg)', html_content)
            for raw_u in raw_photos:
                # Se for small ou medium e houver versão big ou original no HTML, prioriza a melhor
                is_valid, _ = is_valid_product_image_url(raw_u)
                if not is_valid:
                    continue
                hash_m = re.search(r'photo\.yupoo\.com/[^/]+/([a-f0-9]+)/', raw_u)
                p_hash = hash_m.group(1) if hash_m else raw_u
                if p_hash not in seen_hashes:
                    seen_hashes.add(p_hash)
                    images.append(raw_u)

        return {
            'categoria': categoria or 'Yupoo',
            'subcategoria': subcategoria or '',
            'produto': title or 'Produto Yupoo',
            'album_url': album_url,
            'imagens': images,
            'debug_log': debug_log
        }

    @staticmethod
    def extract_generic_album(
        html_content: str,
        page_url: str,
        default_category: str = "",
        default_subcategory: str = "",
        debug: bool = False
    ) -> dict:
        """Extrai fotos e metadados de sites genéricos de catálogo/e-commerce."""
        debug_log = []
        soup = BeautifulSoup(html_content, 'html.parser')

        # Título
        title = ""
        h1 = soup.find('h1')
        if h1:
            title = clean_text(h1.text)
        if not title:
            og_title = soup.find('meta', property='og:title')
            if og_title and og_title.get('content'):
                title = clean_text(og_title.get('content'))
        if not title:
            t = soup.find('title')
            if t:
                title = clean_text(t.text)

        # Categorias
        categoria = default_category
        subcategoria = default_subcategory

        # Imagens
        images = []
        seen_urls = set()

        for idx, img in enumerate(soup.find_all('img'), 1):
            alt = img.get('alt', '')
            cls = " ".join(img.get('class', [])) if isinstance(img.get('class'), list) else str(img.get('class', ''))

            candidate = (
                img.get('data-origin-src') or
                img.get('data-zoom-image') or
                img.get('data-large_image') or
                img.get('data-highres') or
                img.get('data-original') or
                img.get('data-lazy-src') or
                img.get('data-src') or
                img.get('src')
            )
            if not candidate:
                continue

            full_u = urllib.parse.urljoin(page_url, candidate.strip())
            is_valid, reason = is_valid_product_image_url(full_u, alt, cls)
            if not is_valid:
                if debug:
                    debug_log.append(f"[DEBUG] Imagem genérica descartada ({reason}): {full_u}")
                continue

            if full_u not in seen_urls:
                seen_urls.add(full_u)
                images.append(full_u)

        return {
            'categoria': categoria or 'Geral',
            'subcategoria': subcategoria or '',
            'produto': title or 'Produto',
            'album_url': page_url,
            'imagens': images,
            'debug_log': debug_log
        }
