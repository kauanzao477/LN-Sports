# Scraper & Importador de URLs de Produtos e Álbuns (Yupoo Especialista)

Ferramenta de alta performance desenvolvida em Python para extrair URLs diretas de imagens de produtos em alta resolução a partir de catálogos e álbuns (com foco e suporte prioritário para o **Yupoo** e catálogos de vestuário esportivo).

O objetivo principal **NÃO é baixar gigabytes de fotos para o computador**, mas sim obter as URLs canônicas em alta resolução e a estrutura completa de produtos para importação direta na sua loja virtual (estrutura semelhante à Burj Clothing / Shopify / WooCommerce / Nuvemshop).

---

## 📁 Estrutura do Projeto

```
scraper/
│
├── scraper.py             # Script principal com CLI, logs e relatórios
├── crawler.py             # Motor assíncrono para descoberta de categorias, paginação e álbuns
├── extractor.py           # Extrator de imagens em alta resolução e filtros anti-ruído
├── config.py              # Configurações globais (workers, delays, timeouts)
├── links.txt              # Arquivo de entrada com as URLs a serem processadas
├── requirements.txt       # Dependências do projeto
│
├── resultado/             # Pasta gerada automaticamente com os dados
│   ├── produtos.json      # Catálogo estruturado em JSON (categoria, subcategoria, produto, imagens)
│   ├── produtos.csv       # Catálogo em CSV (compatível com Excel Windows via UTF-8 BOM)
│   ├── image_urls.txt     # Apenas URLs únicas de imagens (uma por linha, sem ruído)
│   ├── erros.txt          # Registro de falhas, status HTTP ou timeouts com timestamp
│   └── progresso.json     # Estado incremental para retomada automática
│
└── README.md              # Este manual de instruções
```

---

## ⚙️ Instalação no Windows Passo a Passo

Abra o **Prompt de Comando (CMD)** ou o **PowerShell** na pasta do projeto:

### 1. Verificar a versão do Python
```powershell
python --version
# ou caso utilize o inicializador py:
py --version
```
*(Recomendado: Python 3.10 ou superior)*

### 2. Criar e ativar o ambiente virtual (venv)
```powershell
py -m venv venv
venv\Scripts\activate
```
*(Quando ativado, você verá `(venv)` no início da linha do terminal)*

### 3. Instalar as dependências
```powershell
pip install -r requirements.txt
playwright install
```

---

## 🚀 Como Executar

### 1. Modo de Teste Rápido (Recomendado antes de rodar tudo)
Processa apenas 2 a 3 álbuns para conferir no terminal as fotos encontradas e testa em tempo real se a URL é válida e de alta resolução:
```powershell
python scraper.py --test
# ou
py scraper/scraper.py --test
```

### 2. Execução Completa (Processar todo o catálogo)
Percorre todas as categorias, subcategorias, páginas e todos os álbuns:
```powershell
python scraper.py
# ou
py scraper/scraper.py
```

### 3. Modo Debug (Auditoria de seletores e atributos)
Exibe no terminal os seletores encontrados no HTML, contagem de fotos, atributos utilizados (`data-origin-src`, `data-src`) e motivo de eventuais descartes:
```powershell
python scraper.py --debug
```

### 4. Reiniciar do Zero com Backup Seguro (`--restart`)
Por padrão, o scraper detecta `progresso.json` e continua de onde parou. Se quiser começar do zero, use:
```powershell
python scraper.py --restart
```
> **Segurança:** Ao utilizar `--restart`, o scraper cria automaticamente uma cópia de segurança dos dados anteriores em uma pasta como `resultado_backup_YYYYMMDD_HHMMSS/`.

### 5. Ajustar Conexões Simultâneas (Velocidade)
Você pode alterar a concorrência diretamente na linha de comando:
```powershell
python scraper.py --workers 10
# valores recomendados: 1 (seguro), 5 (padrão ideal), 10 ou 20 (alta velocidade)
```

### 6. Usar Outro Arquivo de Links
```powershell
python scraper.py --input meus_links.txt
```

---

## 🎯 Como o Scraper Trata a Estrutura do Yupoo

Durante a análise detalhada do código-fonte do Yupoo, identificamos a seguinte arquitetura:

1. **Árvore de Categorias e Subcategorias:**
   - O Yupoo organiza categorias pai em classes como `.showheader__category_item` e subcategorias filhas em links com `?isSubCate=true`.
   - O scraper navega na árvore completa, registrando tanto a categoria pai quanto a subcategoria no produto final.

2. **Paginação Completa:**
   - As páginas de categorias possuem o indicador `共XXXX个相册` e paginação `1 / 20`.
   - O scraper lê o total de páginas e gera os links `?page=1`, `?page=2` ... `?page=N`, garantindo que **todos** os álbuns sejam coletados.

3. **Extração de Imagens em Alta Resolução (Sem Substituição Cega):**
   - As fotos reais dos produtos ficam em contêineres `.image__main` e `.showalbum__children`.
   - O Yupoo disponibiliza a foto original real no atributo `data-origin-src` (ex: `https://photo.yupoo.com/minkang/.../870a7176.jpg`) e a versão grande em `data-src` (ex: `https://photo.yupoo.com/.../big.jpg`).
   - O scraper **nunca usa a miniatura** (`small.jpg`) quando houver `data-origin-src` ou `data-src`.
   - As fotos originais são capturadas diretamente dos atributos reais da página, garantindo 100% de autenticidade.

4. **Filtro Anti-Ruído:**
   - Descarta automaticamente logos da plataforma, ícones de navegação, botões, spinners de carregamento, QR codes e avatares.

5. **Armazenamento Incremental:**
   - Após o processamento de **cada álbum individual**, os arquivos `produtos.json`, `produtos.csv`, `image_urls.txt` e `progresso.json` são atualizados no disco.
   - Em caso de queda de energia ou interrupção, **nenhum dado é perdido**.

---

## 📊 Formatos de Saída (`resultado/`)

### `produtos.json`
```json
[
  {
    "categoria": "Liga Profesional",
    "subcategoria": "River Plate",
    "produto": "River Plate Retro Jersey 1996",
    "album_url": "https://minkang.x.yupoo.com/albums/123456?uid=1",
    "imagens": [
      "https://photo.yupoo.com/minkang/abc123/foto1.jpg",
      "https://photo.yupoo.com/minkang/abc123/foto2.jpg"
    ]
  }
]
```

### `produtos.csv`
- Codificado em `UTF-8 com BOM` (`utf-8-sig`) para abrir diretamente no **Microsoft Excel** no Windows sem desformatar acentos ou emojis.
- Colunas: `categoria, subcategoria, produto, album_url, imagem_1, imagem_2, imagem_3, ...` geradas dinamicamente conforme a quantidade de imagens do produto com mais fotos.

### `image_urls.txt`
- Contém **exclusivamente** as URLs únicas das imagens em alta resolução, uma por linha, sem títulos, sem comentários e sem repetições.
```text
https://photo.yupoo.com/minkang/183f13abf7/870a7176.jpg
https://photo.yupoo.com/minkang/4dff260883/45a58da9.jpg
https://photo.yupoo.com/minkang/b5192fb652/a3d83a04.jpg
```
