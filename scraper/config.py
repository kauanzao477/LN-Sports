"""
Configurações Globais do Scraper de Álbuns e Produtos.
Altere os valores abaixo conforme sua necessidade de velocidade e filtros.
"""
import os

# ==============================================================================
# CONCORRÊNCIA E PERFORMANCE
# ==============================================================================
# Número máximo de conexões/tarefas simultâneas para processar álbuns.
# Valores recomendados: 1 (mais seguro/lento), 5 (padrão ideal), 10 ou 20 (rápido).
MAX_WORKERS = 5

# Intervalo mínimo de cortesia entre requisições (em segundos)
REQUEST_DELAY = 0.1

# Timeout em segundos para requisições HTTP
TIMEOUT_SECONDS = 20

# Tentativas em caso de falha de conexão / status 429 ou 503
MAX_RETRIES = 3
RETRY_BACKOFF = 2.0

# ==============================================================================
# ARQUIVOS E DIRETÓRIOS PADRÃO
# ==============================================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_INPUT_FILE = os.path.join(BASE_DIR, 'links.txt')
DEFAULT_OUTPUT_DIR = os.path.join(BASE_DIR, 'resultado')

# Nomes dos arquivos de saída gerados dentro de resultado/
FILE_PRODUTOS_JSON = 'produtos.json'
FILE_PRODUTOS_CSV = 'produtos.csv'
FILE_IMAGE_URLS = 'image_urls.txt'
FILE_ERROS = 'erros.txt'
FILE_PROGRESSO = 'progresso.json'

# ==============================================================================
# HEADERS HTTP
# ==============================================================================
DEFAULT_USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
)

DEFAULT_HEADERS = {
    'User-Agent': DEFAULT_USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
}

# ==============================================================================
# FILTROS DE IMAGENS INDESEJADAS (RUÍDOS, LOGOS, ÍCONES, BANNERS)
# ==============================================================================
# Palavras-chave que indicam imagens de interface que NÃO são fotos de produtos
IGNORE_KEYWORDS = [
    'logo', 'favicon', 'avatar', 'banner', 'icon', 'btn', 'button',
    'loading', 'spinner', 'cart', 'carrinho', 'payment', 'pagamento',
    'visa', 'mastercard', 'pix', 'boleto', 'badge', 'selo', 'footer',
    'header', 'sprite', 'qrcode', 'qr_code', 'star', 'arrow', 'social',
    'facebook', 'instagram', 'whatsapp', 'twitter', 'tiktok', 'youtube',
    'share', 'search', 'close', 'check', 'placeholder', 'blank', 'transparent'
]

# Extensões que geralmente não são produtos fotográficos de alta resolução
IGNORE_EXTENSIONS = ('.svg', '.ico', '.gif')

# ==============================================================================
# CONFIGURAÇÃO DO PLAYWRIGHT (OPCIONAL/DYNAMIC FALLBACK)
# ==============================================================================
PLAYWRIGHT_HEADLESS = True
PLAYWRIGHT_TIMEOUT = 30000  # ms
