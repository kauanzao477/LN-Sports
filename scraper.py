"""
Launcher raiz para executar o scraper a partir do diretório principal.
"""
import sys
import os

root_dir = os.path.dirname(os.path.abspath(__file__))
scraper_dir = os.path.join(root_dir, 'scraper')
sys.path.insert(0, scraper_dir)

# Altera o diretório de trabalho para scraper/ para manter consistência de arquivos
os.chdir(scraper_dir)

from scraper import main

if __name__ == '__main__':
    main()
