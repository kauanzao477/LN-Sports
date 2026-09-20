"""
Motor Assíncrono de Descoberta de Categorias, Subcategorias, Paginação e Álbuns.
Otimizado com máxima prioridade para Yupoo:
- Identifica árvore de categorias e subcategorias
- Percorre todas as páginas de cada categoria (sem parar nas primeiras)
- Deduplica álbuns por ID e URL
- Resiliente a falhas (403, 404, 429, timeout)
"""
import re
import html
import asyncio
import urllib.parse
from typing import List, Dict, Set, Tuple, Optional
import aiohttp
from bs4 import BeautifulSoup
from config import (
    DEFAULT_HEADERS, TIMEOUT_SECONDS, MAX_RETRIES,
    RETRY_BACKOFF, REQUEST_DELAY
)
from extractor import clean_text

class AsyncHttpClient:
    """Gerencia conexões HTTP assíncronas com tratamento rigoroso de headers e retries."""

    def __init__(self, referer: Optional[str] = None):
        self.session: Optional[aiohttp.ClientSession] = None
        self.referer = referer

    async def __aenter__(self):
        headers = dict(DEFAULT_HEADERS)
        if self.referer:
            headers['Referer'] = self.referer
        timeout = aiohttp.ClientTimeout(total=TIMEOUT_SECONDS)
        self.session = aiohttp.ClientSession(headers=headers, timeout=timeout)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session and not self.session.closed:
            await self.session.close()

    async def fetch_text(self, url: str) -> Tuple[int, str]:
        """Realiza requisição GET com backoff exponencial e retorna (status, html)."""
        retries = 0
        backoff = RETRY_BACKOFF
        last_error = ""

        # O Yupoo e seu CDN exigem o Referer correspondente ao domínio do catálogo
        parsed = urllib.parse.urlparse(url)
        dynamic_referer = f"{parsed.scheme}://{parsed.netloc}/"
        headers = {'Referer': dynamic_referer}
        if '1998shoe' in parsed.netloc:
            headers['Cookie'] = 'indexlockcode=HJH001077; indexlockcodeRemember=HJH001077'
        elif 'aj-dongli' in parsed.netloc:
            headers['Cookie'] = 'indexlockcode=888886; indexlockcodeRemember=888886'

        while retries <= MAX_RETRIES:
            try:
                if REQUEST_DELAY > 0:
                    await asyncio.sleep(REQUEST_DELAY)

                async with self.session.get(url, headers=headers) as resp:
                    if resp.status in (429, 503):
                        retries += 1
                        await asyncio.sleep(backoff)
                        backoff *= 2
                        continue

                    text = await resp.text(encoding='utf-8', errors='ignore')
                    return resp.status, text

            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                last_error = str(e)
                retries += 1
                await asyncio.sleep(backoff)
                backoff *= 2

        return 0, f"Falha de conexão: {last_error}"

    async def check_image_url(self, url: str) -> Tuple[int, str, int]:
        """
        Valida se a URL da imagem existe e retorna tamanho e Content-Type.
        Retorna (status_code, content_type, content_length).
        """
        try:
            parsed = urllib.parse.urlparse(url)
            headers = {'Referer': f"{parsed.scheme}://{parsed.netloc}/"}
            
            # Tenta HEAD primeiro
            async with self.session.head(url, headers=headers, allow_redirects=True) as resp:
                content_type = resp.headers.get('Content-Type', '')
                content_len = int(resp.headers.get('Content-Length', 0))
                if resp.status == 200:
                    return 200, content_type, content_len

                # Se HEAD retornar 403 ou 405 (alguns CDNs bloqueiam HEAD), testa GET com Range parcial
                if resp.status in (403, 405):
                    headers['Range'] = 'bytes=0-2048'
                    async with self.session.get(url, headers=headers, allow_redirects=True) as resp_get:
                        c_type = resp_get.headers.get('Content-Type', '')
                        c_len = int(resp_get.headers.get('Content-Length', 0))
                        if resp_get.status in (200, 206):
                            return 200, c_type, c_len
                        return resp_get.status, c_type, c_len

                return resp.status, content_type, content_len
        except Exception as e:
            return 0, f"Erro: {str(e)}", 0

class CatalogCrawler:
    """Rastreador de catálogos com suporte de alta fidelidade ao Yupoo."""

    def __init__(self, http_client: AsyncHttpClient):
        self.http = http_client

    async def discover_all_albums_yupoo(
        self,
        start_url: str,
        on_progress=None,
        debug: bool = False,
        max_albums: Optional[int] = None,
        source_category: Optional[str] = None
    ) -> List[Dict]:
        """
        Percorre todo o catálogo Yupoo:
        1. Identifica categorias pai e subcategorias filhas.
        2. Navega em todas as páginas de cada categoria (1, 2, 3... até o fim).
        3. Coleta os links de todos os álbuns associando categoria e subcategoria.
        4. Deduplica para evitar processamento redundante.
        """
        # Normaliza formato legado x.yupoo.com/photos/<user>
        m_photo = re.match(r'https?://x\.yupoo\.com/photos/([^/]+)', start_url)
        if m_photo:
            user = m_photo.group(1)
            start_url = f"https://{user}.x.yupoo.com/categories"

        parsed_base = urllib.parse.urlparse(start_url)
        origin = f"{parsed_base.scheme}://{parsed_base.netloc}"

        # Se a URL fornecida for diretamente um álbum, retorna imediatamente
        if '/albums/' in start_url:
            return [{
                'album_url': start_url,
                'categoria': source_category or 'Yupoo',
                'subcategoria': '',
                'source_category': source_category,
                'source_url': start_url
            }]

        status, html_content = await self.http.fetch_text(start_url)
        if status != 200:
            if on_progress:
                on_progress(f"[ERROR] Falha ao acessar URL inicial: {start_url} (HTTP {status})")
            return []

        soup = BeautifulSoup(html_content, 'html.parser')

        # 1. IDENTIFICAÇÃO DA ÁRVORE DE CATEGORIAS E SUBCATEGORIAS
        category_entries: List[Dict] = []
        seen_cat_urls = set()

        # Se a URL de entrada já for uma categoria específica, busca ou álbuns, processa DIRETAMENTE ela
        is_specific_target = bool(re.search(r'/categories/\d+', start_url)) or ('/search/' in start_url) or ('/albums' in start_url and '/categories' not in start_url)

        if is_specific_target:
            cat_name = clean_text(soup.find('title').text) if soup.find('title') else 'Categoria'
            cat_name = re.sub(r'\s*-\s*Yupoo.*$', '', cat_name, flags=re.IGNORECASE).strip()
            cat_name = re.sub(r'^\s*分类\s*\|\s*', '', cat_name).strip()
            category_entries.append({
                'url': start_url,
                'categoria': source_category or cat_name,
                'subcategoria': cat_name if (source_category and cat_name != source_category) else '',
                'source_category': source_category
            })
        else:
            # 1.1 Busca categorias na barra lateral (categories__box-left) se existir
            left_box = soup.find(class_='categories__box-left')
            if left_box:
                for a in left_box.find_all('a', href=True):
                    href = a['href'].strip()
                    name = clean_text(a.text)
                    if href and '/categories/' in href:
                        full_cat = urllib.parse.urljoin(origin, href)
                        if full_cat not in seen_cat_urls:
                            seen_cat_urls.add(full_cat)
                            category_entries.append({
                                'url': full_cat,
                                'categoria': source_category or name,
                                'subcategoria': name if source_category else '',
                                'source_category': source_category
                            })

            # 1.2 Busca itens do menu de cabeçalho (showheader__category_item)
            cat_items = soup.find_all('li', class_=re.compile(r'showheader__category_item|showheader_item'))
            for item in cat_items:
                parent_a = item.find('a', href=True)
                if not parent_a:
                    continue
                parent_href = parent_a['href'].strip()
                parent_name = clean_text(parent_a.text)
                if not parent_href or parent_name.lower() in ['all categories', 'home', '']:
                    continue

                sub_items = item.find_all('li')
                if sub_items:
                    for s in sub_items:
                        sub_a = s.find('a', href=True)
                        if not sub_a:
                            continue
                        sub_href = sub_a['href'].strip()
                        sub_name = clean_text(sub_a.text)
                        full_sub_url = urllib.parse.urljoin(origin, sub_href)
                        if full_sub_url not in seen_cat_urls:
                            seen_cat_urls.add(full_sub_url)
                            category_entries.append({
                                'url': full_sub_url,
                                'categoria': source_category or parent_name,
                                'subcategoria': f"{parent_name} - {sub_name}" if source_category else sub_name,
                                'source_category': source_category
                            })
                else:
                    full_parent_url = urllib.parse.urljoin(origin, parent_href)
                    if full_parent_url not in seen_cat_urls:
                        seen_cat_urls.add(full_parent_url)
                        category_entries.append({
                            'url': full_parent_url,
                            'categoria': source_category or parent_name,
                            'subcategoria': parent_name if source_category else '',
                            'source_category': source_category
                        })

        # Fallback: Se não houver menu, usa a própria página
        if not category_entries:
            category_entries.append({
                'url': start_url,
                'categoria': source_category or 'Geral',
                'subcategoria': '',
                'source_category': source_category
            })

        if on_progress:
            on_progress(f"[INFO] Total de categorias/subcategorias encontradas: {len(category_entries)}")

        # 2. PERCORRER TODAS AS PÁGINAS DE CADA CATEGORIA
        all_albums: List[Dict] = []
        seen_album_keys: Set[str] = set()

        for cat_idx, cat in enumerate(category_entries, 1):
            cat_url = cat['url']
            cat_name = cat['categoria']
            sub_name = cat['subcategoria']
            display_name = f"{cat_name} > {sub_name}" if sub_name else cat_name

            if on_progress:
                on_progress(f"[{cat_idx}/{len(category_entries)}] Processando categoria: {display_name}")

            page = 1
            max_pages = 1
            while page <= max_pages:
                sep = '&' if '?' in cat_url else '?'
                page_url = f"{cat_url}{sep}page={page}" if page > 1 else cat_url

                p_status, p_html = await self.http.fetch_text(page_url)
                if p_status != 200:
                    break

                # Detecta total de páginas indicado pelo Yupoo (ex: "1 / 20")
                page_match = re.search(r'class=["\'][^"\']*pagination-span[^"\']*["\'][^>]*>(\d+)\s*/\s*(\d+)<', p_html)
                if page_match:
                    try:
                        max_pages = int(page_match.group(2))
                    except ValueError:
                        pass

                # Extrai links de álbuns na página (formato /albums/<id>?...)
                album_matches = re.findall(r'href=["\'](/albums/\d+[^"\']*)["\']', p_html)
                new_in_page = 0

                for a_href in album_matches:
                    clean_href = html.unescape(a_href)
                    full_album_url = urllib.parse.urljoin(origin, clean_href)
                    
                    # Deduplicação pelo ID numérico do álbum
                    id_match = re.search(r'/albums/(\d+)', full_album_url)
                    album_key = id_match.group(1) if id_match else full_album_url

                    if album_key not in seen_album_keys:
                        seen_album_keys.add(album_key)
                        all_albums.append({
                            'album_url': full_album_url,
                            'categoria': source_category or cat_name,
                            'subcategoria': sub_name,
                            'source_category': source_category,
                            'source_url': start_url
                        })
                        new_in_page += 1
                        if max_albums and len(all_albums) >= max_albums:
                            return all_albums

                if max_albums and len(all_albums) >= max_albums:
                    return all_albums

                # Se não houver novos álbuns e passou da página 1, encerra a categoria
                if new_in_page == 0 and page > 1:
                    break

                # Verifica se botão "próxima" está desabilitado
                has_next = 'pagination-button-next' in p_html and 'pagination-button-disabled' not in p_html[p_html.find('pagination-button-next'):p_html.find('pagination-button-next')+120]
                if not has_next and page >= max_pages:
                    break

                page += 1

        return all_albums

    async def discover_generic_albums(self, start_url: str, on_progress=None) -> List[Dict]:
        """Suporte complementar para lojas ou catálogos genéricos."""
        parsed = urllib.parse.urlparse(start_url)
        origin = f"{parsed.scheme}://{parsed.netloc}"

        all_products: List[Dict] = []
        seen_urls: Set[str] = set()

        current_url = start_url
        page_num = 1
        visited = set()

        while current_url and current_url not in visited and page_num <= 50:
            visited.add(current_url)
            status, html_content = await self.http.fetch_text(current_url)
            if status != 200:
                break

            soup = BeautifulSoup(html_content, 'html.parser')
            cat_title = clean_text(soup.find('h1').text) if soup.find('h1') else 'Geral'

            for a in soup.find_all('a', href=True):
                href = a['href']
                if any(k in href for k in ['/produto/', '/product/', '/item/', '/p/']):
                    full_p_url = urllib.parse.urljoin(origin, href)
                    if full_p_url not in seen_urls:
                        seen_urls.add(full_p_url)
                        all_products.append({
                            'album_url': full_p_url,
                            'categoria': cat_title,
                            'subcategoria': ''
                        })

            # Paginação genérica
            next_url = None
            next_link = soup.find('a', rel='next')
            if not next_link:
                for a in soup.find_all('a', href=True):
                    if a.text.strip().lower() in ['next', 'próxima', 'proxima', '>', '»', '下一页']:
                        next_link = a
                        break

            if next_link and next_link.get('href'):
                next_url = urllib.parse.urljoin(origin, next_link['href'])

            current_url = next_url
            page_num += 1

        return all_products
