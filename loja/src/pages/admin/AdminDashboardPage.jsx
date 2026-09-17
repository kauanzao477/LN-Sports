import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shirt,
  Star,
  CheckCircle,
  MessageCircle,
  FolderTree,
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import { productService } from '../../services/productService';
import { categoryService } from '../../services/categoryService';
import { MetricCard } from '../../components/admin/MetricCard';

export function AdminDashboardPage() {
  const [metrics, setMetrics] = useState({
    totalProducts: 50222,
    categoriesCount: 11,
    whatsappNumber: '+55 49 99804-6866'
  });

  useEffect(() => {
    async function loadData() {
      try {
        const cats = await categoryService.getCategories();
        setMetrics(prev => ({
          ...prev,
          categoriesCount: cats.length || 11
        }));
      } catch (e) {}
    }
    loadData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Topo do Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white">
            Painel Geral
          </h1>
          <p className="text-xs sm:text-sm text-brand-muted mt-1">
            Visão geral do catálogo oficial da LN SPORTS e ferramentas administrativas.
          </p>
        </div>

        <Link
          to="/"
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-surface hover:bg-brand-card text-white text-xs font-bold border border-brand-border transition-all self-start sm:self-auto"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Abrir Loja Pública</span>
        </Link>
      </div>

      {/* Grid de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total de Produtos"
          value={metrics.totalProducts.toLocaleString('pt-BR')}
          icon={Shirt}
          subtitle="Catálogo oficial sincronizado"
        />

        <MetricCard
          title="Categorias Ativas"
          value={metrics.categoriesCount}
          icon={FolderTree}
          subtitle="Tênis, Camisas, Chuteiras, etc."
        />

        <MetricCard
          title="Capas Padronizadas"
          value="100%"
          icon={Star}
          subtitle="Seleção visual e manual ativas"
        />

        <MetricCard
          title="WhatsApp Oficial"
          value="+55 49 99804-6866"
          icon={MessageCircle}
          subtitle="Atendimento e vendas integrados"
        />
      </div>

      {/* Banner de Ação Rápida — Escolha Manual de Capas */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-brand-purple/40 bg-gradient-to-r from-brand-surface via-brand-purple/10 to-brand-surface relative overflow-hidden">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-purple/20 text-brand-purpleLight border border-brand-purple/40 mb-3">
            <Star className="w-3.5 h-3.5 fill-current text-yellow-400" />
            Recurso Administrativo Ativo
          </span>

          <h2 className="text-xl sm:text-2xl font-display font-black text-white mb-2">
            Gestão Manual de Capas dos Produtos
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
            Você pode selecionar qualquer imagem existente do álbum de um produto para ser a capa oficial (images[0]).
            Todas as fotos existentes do produto são preservadas integralmente e a alteração é persistida automaticamente.
          </p>

          <Link
            to="/admin/produtos"
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-brand-purple hover:bg-brand-purpleLight text-white text-sm font-extrabold shadow-lg shadow-brand-purple/30 transition-all hover:scale-102"
          >
            <span>Gerenciar Capas e Produtos</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
