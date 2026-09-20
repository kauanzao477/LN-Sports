import { getCoverImage } from '../../utils/coverUtils';
import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Star,
  CheckCircle2,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Shirt,
  Image as ImageIcon
} from 'lucide-react';
import { productService, PRODUCTS_PER_PAGE } from '../../services/productService';
import { categoryService } from '../../services/categoryService';
import { ProductImage } from '../../components/product/ProductImage';

export function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal de edição de capa
  const [editingProduct, setEditingProduct] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Carrega categorias disponíveis
  useEffect(() => {
    async function loadCats() {
      const cats = await categoryService.getCategories();
      setCategories(cats);
    }
    loadCats();
  }, []);

  // Busca produtos
  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await productService.getProducts({
        page,
        limitCount: 16,
        searchQuery,
        category: selectedCategory || null,
        sortBy: 'newest'
      });
      setProducts(res.data || []);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.total || 0);
    } catch (err) {
      console.error('[AdminProductsPage] erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [page, selectedCategory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadProducts();
  };

  // Define uma imagem existente como capa (images[0])
  const handleSelectCover = async (imageIndex) => {
    if (!editingProduct) return;
    try {
      const updated = await productService.setProductCover(editingProduct, imageIndex);
      setEditingProduct(updated);

      // Atualiza na lista de produtos exibida
      setProducts(prev => prev.map(p =>
        ((p.sourceUrl && p.sourceUrl === updated.sourceUrl) || (p.slug && p.slug === updated.slug))
          ? { ...p, images: updated.images, mainImageIndex: 0 }
          : p
      ));

      setFeedbackMsg(`Imagem ${imageIndex + 1} definida como capa principal (images[0]) com sucesso!`);
      setTimeout(() => setFeedbackMsg(''), 3000);
    } catch (err) {
      console.error('Erro ao definir capa:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white">
            Gerenciador de Capas e Produtos
          </h1>
          <p className="text-xs sm:text-sm text-brand-muted mt-1">
            Selecione qualquer foto do álbum para definir manualmente como a capa oficial (images[0])
          </p>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-surface border border-brand-purple/40 text-brand-purpleLight">
            {totalCount.toLocaleString('pt-BR')} produtos cadastrados
          </span>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="glass-card p-4 rounded-2xl border border-brand-border space-y-4 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-brand-muted absolute left-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome do modelo, time ou slug..."
            className="w-full bg-brand-surface border border-brand-border text-white text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-brand-purple"
          />
        </form>

        <div className="flex items-center gap-3">
          <div className="relative min-w-[200px]">
            <Filter className="w-4 h-4 text-brand-muted absolute left-3.5 top-3.5 pointer-events-none" />
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full bg-brand-surface border border-brand-border text-white text-sm rounded-xl pl-10 pr-8 py-2.5 appearance-none focus:outline-none focus:border-brand-purple cursor-pointer"
            >
              <option value="">Todas as Categorias</option>
              {categories.map((cat) => (
                <option key={cat.id || cat.slug} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setPage(1);
              loadProducts();
            }}
            className="px-4 py-2.5 bg-brand-purple hover:bg-brand-purpleLight text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-brand-purple/20 shrink-0"
          >
            Filtrar
          </button>
        </div>
      </div>

      {/* Grid de Produtos */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-white">
          <div className="w-10 h-10 rounded-full border-4 border-brand-purple/20 border-t-brand-purpleLight animate-spin mb-4" />
          <p className="text-sm text-brand-muted">Carregando catálogo para edição...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center glass-card rounded-2xl border border-brand-border p-8">
          <Shirt className="w-12 h-12 text-brand-muted mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">Nenhum produto encontrado</h3>
          <p className="text-xs text-brand-muted">Tente ajustar a busca ou a categoria selecionada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => {
            const mainIdx = (product.mainImageIndex !== undefined && product.mainImageIndex !== null) ? product.mainImageIndex : 0;
            const coverImg = product.images?.[mainIdx] || getCoverImage(product) || null;
            const imgCount = product.images?.length || 0;

            return (
              <div
                key={product.slug || product.sourceUrl}
                className="glass-card rounded-2xl p-3 border border-brand-border flex flex-col justify-between hover:border-brand-purple/50 transition-all group"
              >
                <div>
                  {/* Capa Atual */}
                  <div className="relative overflow-hidden rounded-xl bg-brand-surface aspect-[4/5] mb-2.5">
                    <ProductImage
                      src={coverImg}
                      alt={product.name}
                      aspectRatio="aspect-[4/5]"
                      className="w-full h-full object-cover"
                    />

                    <div className="absolute top-2 left-2 z-10">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-brand-dark/80 backdrop-blur-md text-brand-purpleLight border border-brand-purple/40">
                        <Star className="w-2.5 h-2.5 fill-current text-yellow-400" />
                        Capa Atual
                      </span>
                    </div>

                    <div className="absolute bottom-2 right-2 z-10">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/70 backdrop-blur-md text-white">
                        <ImageIcon className="w-2.5 h-2.5" />
                        {imgCount} fotos
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-purpleNeon mb-1 truncate">
                    {product.category || 'Geral'}
                  </p>
                  <h3
                    className="font-bold text-xs sm:text-sm text-white line-clamp-2 mb-2 leading-snug"
                    title={product.name}
                  >
                    {product.name}
                  </h3>
                </div>

                <div className="pt-2 border-t border-brand-border/60 flex items-center gap-2">
                  <button
                    onClick={() => setEditingProduct(product)}
                    className="flex-1 py-2 px-3 rounded-xl bg-brand-purple hover:bg-brand-purpleLight text-white text-xs font-bold transition-all text-center"
                  >
                    Escolher Capa
                  </button>

                  <a
                    href={`/produto/${product.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-brand-surface hover:bg-brand-card text-brand-muted hover:text-white border border-brand-border transition-colors"
                    title="Ver página do produto na loja"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-6 border-t border-brand-border/60">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="p-2.5 rounded-xl bg-brand-surface border border-brand-border text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-card transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-300">
            Página <span className="text-brand-purpleLight">{page}</span> de {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="p-2.5 rounded-xl bg-brand-surface border border-brand-border text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-card transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MODAL DE ESCOLHA MANUAL DA CAPA DO PRODUTO */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass-card rounded-3xl border border-brand-border w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Topo do Modal */}
            <div className="p-5 sm:p-6 border-b border-brand-border flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-purpleLight">
                  {editingProduct.category}
                </span>
                <h2 className="text-lg sm:text-xl font-display font-black text-white mt-0.5 leading-tight">
                  {editingProduct.name}
                </h2>
                <p className="text-xs text-brand-muted mt-1">
                  Clique em qualquer imagem para defini-la como a nova capa (images[0]). Todas as {editingProduct.images?.length || 0} fotos são preservadas.
                </p>
              </div>

              <button
                onClick={() => setEditingProduct(null)}
                className="p-2 rounded-xl text-brand-muted hover:text-white hover:bg-brand-card shrink-0 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notificação / Feedback */}
            {feedbackMsg && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{feedbackMsg}</span>
              </div>
            )}

            {/* Grid de Todas as Imagens do Álbum */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 scrollbar-thin">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {editingProduct.images && editingProduct.images.map((imgUrl, index) => {
                  const isCurrentCover = index === 0;

                  return (
                    <div
                      key={index}
                      className={`relative rounded-2xl overflow-hidden border-2 transition-all p-1.5 flex flex-col justify-between ${
                        isCurrentCover
                          ? 'border-brand-purpleLight bg-brand-purple/10 shadow-lg shadow-brand-purple/30'
                          : 'border-brand-border bg-brand-surface hover:border-slate-400'
                      }`}
                    >
                      <div className="relative aspect-square rounded-xl overflow-hidden mb-2">
                        <ProductImage
                          src={imgUrl}
                          alt={`Foto ${index + 1}`}
                          aspectRatio="aspect-square"
                          className="w-full h-full object-cover"
                        />

                        {/* Tag de Capa Atual */}
                        {isCurrentCover ? (
                          <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-brand-purple text-white text-[10px] font-extrabold flex items-center gap-1 shadow-md">
                            <Star className="w-3 h-3 fill-current text-yellow-300" />
                            <span>Capa Atual (images[0])</span>
                          </div>
                        ) : (
                          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold">
                            Foto {index + 1}
                          </div>
                        )}
                      </div>

                      {/* Botão de Ação */}
                      {isCurrentCover ? (
                        <div className="py-2 text-center text-xs font-bold text-brand-purpleLight bg-brand-purple/20 rounded-xl">
                          ✓ Capa Oficial
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSelectCover(index)}
                          className="w-full py-2 px-3 rounded-xl bg-brand-surface hover:bg-brand-purple hover:text-white text-slate-200 border border-brand-border hover:border-brand-purple text-xs font-extrabold transition-all active:scale-95"
                        >
                          Definir como Capa
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 border-t border-brand-border bg-brand-dark/60 flex items-center justify-between text-xs text-brand-muted">
              <span>
                Total de fotos no álbum: <strong>{editingProduct.images?.length || 0}</strong>
              </span>
              <button
                onClick={() => setEditingProduct(null)}
                className="px-5 py-2 rounded-xl bg-brand-surface hover:bg-brand-card text-white font-bold transition-colors border border-brand-border"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

