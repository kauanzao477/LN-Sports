#!/usr/bin/env python3
"""
reordenar_capas.py  (versao sem download de imagens)
=====================================================
Reordena images[] para colocar a MELHOR capa em images[0]
usando APENAS heuristica posicional + analise de sourceUrl.

Nao baixa nenhuma imagem. Trabalha somente com os dados existentes.

Heuristica baseada em inspecao manual dos fornecedores:

aj-dongli (Tenis Esportivos, 25.015 produtos):
  - img_00: quase sempre caixa/embalagem com etiqueta de preco
  - img_01..03: angulo parcial, detalhe
  - img_04..07: melhor angulo (par completo, perspectiva 3/4)
  - img_08+: palmilha, sola, inner view

sdh60889 (Tenis On Running e HOKA, 2.651 produtos):
  - padrao similar ao aj-dongli
  - img_00: caixa
  - img_05..06: melhor angulo (inspecao visual confirmada)

minkang (Camisetas, 7.619 produtos):
  - img_00: sacola plastica ou nota fiscal frequente
  - img_01..02: camiseta completa frente
  - img_03+: costas, detalhe, modelo vestindo

Threshold: so altera se score_atual - score_melhor >= 0.35
(conservador para nao piorar capas ja boas)
"""

import json, os, sys, shutil, datetime
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
PRODUTOS_PATHS = [
    BASE_DIR / 'loja' / 'src' / 'data' / 'produtos.json',
    BASE_DIR / 'loja' / 'public' / 'data' / 'produtos.json',
    BASE_DIR / 'loja' / 'public' / 'produtos.json',
]
RESULTADO_DIR = BASE_DIR / 'scraper' / 'resultado'
RESULTADO_DIR.mkdir(exist_ok=True)

TARGET_CATEGORIES = {
    'T\u00eanis Esportivos',
    'T\u00eanis On Running e HOKA',
    'Camisetas de Time',
    'Camisetas de Time Retr\u00f4',
}

# ─────────────────────────────────────────────────────────────────────────────
# Heuristica posicional por fornecedor
# ─────────────────────────────────────────────────────────────────────────────

def get_supplier(source_url):
    """Identifica o fornecedor a partir da sourceUrl."""
    if not source_url:
        return 'unknown'
    if 'aj-dongli' in source_url:
        return 'aj-dongli'
    if 'sdh60889' in source_url:
        return 'sdh60889'
    if 'minkang' in source_url:
        return 'minkang'
    return 'unknown'

def position_score(idx, total, supplier):
    """
    Score de PENALIDADE posicional (0.0 = otimo, 1.0 = pessimo para capa).
    Baseado em inspecao manual das amostras.
    """
    if total <= 1:
        return 0.0

    ratio = idx / max(total - 1, 1)

    if supplier in ('aj-dongli', 'sdh60889'):
        # Tenis: caixa no inicio, fotos ideais no meio
        if idx == 0:
            return 0.80   # Alta chance de ser caixa/embalagem
        if idx == 1:
            return 0.55   # Pode ser outro angulo da caixa ou detalhe
        if idx == 2:
            return 0.40   # Angulo parcial ainda
        if idx == 3:
            return 0.30   # Pode ser bom, mas mais arriscado
        if 4 <= idx <= 7:
            return 0.05   # Zona ideal: par completo, perspectiva 3/4 (INSPECAO CONFIRMADA)
        if 8 <= idx <= 10:
            return 0.25   # Bons mas nem tanto quanto 4-7
        if idx >= 11:
            return 0.55   # Palmilha, sola, detalhe no final

    elif supplier == 'minkang':
        # Camisetas
        if idx == 0:
            return 0.70   # Sacola plastica ou nota fiscal frequente
        if idx == 1:
            return 0.05   # Camiseta frente completa (INSPECAO CONFIRMADA)
        if idx == 2:
            return 0.10   # Frente ou costas completa
        if idx == 3:
            return 0.20   # Costas ou modelo vestindo
        if idx == 4:
            return 0.25   # Detalhe ou zoom
        if ratio > 0.75:
            return 0.50   # Etiqueta, codigo, detalhe
        return 0.35

    else:
        # Fornecedor desconhecido: heuristica generica conservadora
        if idx == 0:
            return 0.55
        if 1 <= idx <= 3:
            return 0.30
        if 4 <= idx <= 7:
            return 0.10
        if ratio > 0.80:
            return 0.50
        return 0.35

    return 0.30

def choose_best_cover(images, source_url, threshold=0.35):
    """
    Escolhe melhor indice para capa usando heuristica posicional.
    So troca se diferenca de score for >= threshold.
    Retorna (indice_melhor, motivo, confianca).
    """
    n = len(images)
    if n <= 1:
        return 0, "unica_imagem", 1.0
    if n == 2:
        # Com apenas 2 imagens, muito arriscado trocar
        return 0, "apenas_2_imagens", 0.0

    supplier = get_supplier(source_url)

    # Analisa as primeiras N imagens (maximo 14)
    n_check = min(n, 14)
    scores = [position_score(i, n, supplier) for i in range(n_check)]

    current_score = scores[0]
    best_idx = int(min(range(n_check), key=lambda i: scores[i]))
    best_score = scores[best_idx]
    diff = current_score - best_score

    if best_idx == 0:
        return 0, "atual_ja_e_melhor(score=%.2f)" % current_score, diff

    if diff < threshold:
        return 0, "confianca_baixa(diff=%.2f,supplier=%s)" % (diff, supplier), diff

    motivo = "supplier=%s,pos0=%.2f,melhor=idx%d(%.2f),diff=%.2f" % (
        supplier, current_score, best_idx, best_score, diff
    )
    return best_idx, motivo, diff

# ─────────────────────────────────────────────────────────────────────────────
# Processamento
# ─────────────────────────────────────────────────────────────────────────────

def process_products(products, threshold=0.35):
    stats = {
        'total_verificados': 0,
        'total_alterados': 0,
        'sem_alteracao': 0,
        'baixa_confianca': 0,
        'por_categoria': {cat: {'verificados': 0, 'alterados': 0}
                          for cat in TARGET_CATEGORIES},
        'alteracoes': [],
    }

    target = [p for p in products if p.get('category') in TARGET_CATEGORIES]
    print("Produtos nas categorias-alvo: %d" % len(target))

    # Conta por fornecedor
    forn_count = {}
    for p in target:
        s = get_supplier(p.get('sourceUrl', ''))
        forn_count[s] = forn_count.get(s, 0) + 1
    print("Por fornecedor:", forn_count)

    for i, product in enumerate(target):
        cat = product.get('category', '')
        images = product.get('images', [])
        source_url = product.get('sourceUrl', '')

        if not images:
            continue

        stats['total_verificados'] += 1
        if cat in stats['por_categoria']:
            stats['por_categoria'][cat]['verificados'] += 1

        if len(images) <= 2:
            stats['sem_alteracao'] += 1
            continue

        best_idx, motivo, confianca = choose_best_cover(images, source_url, threshold)

        if best_idx > 0:
            original_cover = images[0]
            nova_cover = images[best_idx]
            # Move melhor para [0], mantendo ordem relativa dos demais
            new_images = [nova_cover] + [img for j, img in enumerate(images) if j != best_idx]
            product['images'] = new_images

            stats['total_alterados'] += 1
            if cat in stats['por_categoria']:
                stats['por_categoria'][cat]['alterados'] += 1
            stats['alteracoes'].append({
                'id': product.get('id'),
                'slug': product.get('slug'),
                'category': cat,
                'cover_anterior': original_cover,
                'cover_nova': nova_cover,
                'indice_selecionado': best_idx,
                'motivo': motivo,
                'confianca': round(confianca, 3),
                'total_imagens': len(images),
            })
        else:
            if 'confianca_baixa' in motivo:
                stats['baixa_confianca'] += 1
            stats['sem_alteracao'] += 1

        if (i + 1) % 5000 == 0:
            print("  [%d/%d] processados... (%d alterados)" % (
                i+1, len(target), stats['total_alterados']
            ))

    return stats

# ─────────────────────────────────────────────────────────────────────────────
# Validacao de integridade
# ─────────────────────────────────────────────────────────────────────────────

def validar_integridade(products, meta_antes):
    total_depois = len(products)
    imgs_depois = sum(len(p.get('images', [])) for p in products)
    source_urls = set(p.get('sourceUrl', '') for p in products)

    erros = []
    if total_depois != meta_antes['total']:
        erros.append("PRODUTOS: %d -> %d" % (meta_antes['total'], total_depois))
    if imgs_depois != meta_antes['imgs']:
        erros.append("IMAGENS: %d -> %d" % (meta_antes['imgs'], imgs_depois))
    if source_urls != meta_antes['source_urls']:
        diff = source_urls.symmetric_difference(meta_antes['source_urls'])
        erros.append("SOURCE_URLS ALTERADAS! Diff: %d" % len(diff))

    return erros, total_depois, imgs_depois

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("=" * 65)
    print("REORDENAR CAPAS - LN Sports (sem download de imagens)")
    print("Metodo: heuristica posicional por fornecedor")
    print("=" * 65)

    primary_path = PRODUTOS_PATHS[0]
    if not primary_path.exists():
        print("ERRO: %s nao encontrado!" % primary_path)
        sys.exit(1)

    print("\nCarregando produtos...")
    with open(primary_path, 'r', encoding='utf-8') as f:
        products = json.load(f)

    total_antes = len(products)
    imgs_antes = sum(len(p.get('images', [])) for p in products)
    source_urls_antes = set(p.get('sourceUrl', '') for p in products)

    print("Produtos: %d | Imagens: %d" % (total_antes, imgs_antes))

    # Contagem Tenis Casuais (relatorio)
    tc_count = sum(1 for p in products
                   if 'T\u00eanis Casuais' in p.get('category', ''))
    print("Tenis Casuais (todos): %d" % tc_count)

    # Backup dos 3 arquivos
    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    for path in PRODUTOS_PATHS:
        if path.exists():
            bak = str(path) + '.bak_capas_%s' % ts
            shutil.copy2(path, bak)
            print("Backup: %s" % Path(bak).name)
        else:
            print("AVISO: nao encontrado: %s" % path)

    print("\nProcessando capas (threshold=0.35)...")
    stats = process_products(products, threshold=0.35)

    # Valida integridade
    meta_antes = {'total': total_antes, 'imgs': imgs_antes, 'source_urls': source_urls_antes}
    erros, total_depois, imgs_depois = validar_integridade(products, meta_antes)

    if erros:
        print("\n*** ERRO DE INTEGRIDADE - ABORTANDO ***")
        for e in erros:
            print("  " + e)
        sys.exit(1)

    print("Validacao de integridade: OK")

    # Salva os 3 JSONs
    print("\nSalvando os 3 JSONs...")
    saved = []
    for path in PRODUTOS_PATHS:
        if path.exists():
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(products, f, ensure_ascii=False, separators=(',', ':'))
            saved.append(path)
            print("  OK: %s (%d bytes)" % (path.name, path.stat().st_size))
        else:
            print("  AVISO: nao existe, criando: %s" % path)
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(products, f, ensure_ascii=False, separators=(',', ':'))
            saved.append(path)

    # Verifica sincronizacao (tamanhos iguais)
    sizes = [path.stat().st_size for path in saved if path.exists()]
    sync_ok = len(set(sizes)) == 1
    print("\nSincronizacao dos 3 JSONs: %s" % ("OK (identicos)" if sync_ok else "DIFERENCA!"))

    # Salva relatorio
    report = {
        'timestamp': ts,
        'metodo': 'posicional_sem_download_v2',
        'threshold': 0.35,
        'total_produtos': total_depois,
        'imgs_antes': imgs_antes,
        'imgs_depois': imgs_depois,
        'total_verificados': stats['total_verificados'],
        'total_alterados': stats['total_alterados'],
        'sem_alteracao': stats['sem_alteracao'],
        'manteve_baixa_confianca': stats['baixa_confianca'],
        'por_categoria': stats['por_categoria'],
        'sync_ok': sync_ok,
        'tenis_casuais_count': tc_count,
        'sample_alteracoes': stats['alteracoes'][:200],
    }
    rpath = RESULTADO_DIR / ('relatorio_capas_%s.json' % ts)
    with open(rpath, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print("Relatorio: %s" % rpath.name)

    # Resumo
    print("\n" + "=" * 65)
    print("RESUMO")
    print("=" * 65)
    print("Produtos antes/depois:    %d / %d" % (total_antes, total_depois))
    print("Imagens antes/depois:     %d / %d" % (imgs_antes, imgs_depois))
    print("Perda de imagens:         %s" % ("NAO" if imgs_depois == imgs_antes else "SIM - ERRO!"))
    print("Capas corrigidas:         %d" % stats['total_alterados'])
    print("Sem alteracao:            %d" % stats['sem_alteracao'])
    print("Manteve baixa confianca:  %d" % stats['baixa_confianca'])
    print("Tenis Casuais:            %d" % tc_count)
    print("JSONs sincronizados:      %s" % ("SIM" if sync_ok else "NAO"))
    print("\nPor categoria:")
    for cat, s in stats['por_categoria'].items():
        v = s['verificados']
        a = s['alterados']
        pct = 0 if v == 0 else 100.0 * a / v
        print("  %-42s %5d/%d (%.1f%%)" % (cat + ':', a, v, pct))
    print("\nConcluido!")

if __name__ == '__main__':
    main()
