import React, { useState, useEffect } from "react";
import {
  FolderTree,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Package,
  ExternalLink,
  Plus,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { categoryService, OFFICIAL_CATEGORIES } from "../../services/categoryService";
import { Link } from "react-router-dom";

const CATEGORY_COLORS = {
  "tenis-esportivos":        { from: "from-violet-600", to: "to-purple-700",   ring: "ring-violet-500/30" },
  "tenis-casuais":           { from: "from-blue-500",   to: "to-cyan-600",     ring: "ring-blue-500/30" },
  "tenis-on-running-e-hoka": { from: "from-emerald-500",to: "to-teal-600",     ring: "ring-emerald-500/30" },
  "camisetas-de-time":       { from: "from-rose-500",   to: "to-pink-600",     ring: "ring-rose-500/30" },
  "camisetas-de-time-retro": { from: "from-amber-500",  to: "to-orange-600",   ring: "ring-amber-500/30" },
  "chuteiras":               { from: "from-sky-500",    to: "to-blue-600",     ring: "ring-sky-500/30" },
  "chuteiras-infantil":      { from: "from-lime-500",   to: "to-green-600",    ring: "ring-lime-500/30" },
  "sapatilhas-de-atletismo": { from: "from-fuchsia-500",to: "to-purple-600",   ring: "ring-fuchsia-500/30" },
};

function getCategoryColors(slug) {
  return CATEGORY_COLORS[slug] || { from: "from-slate-500", to: "to-slate-600", ring: "ring-slate-500/30" };
}

function CategoryCard({ category }) {
  const [expanded, setExpanded] = useState(false);
  const colors = getCategoryColors(category.slug);
  const count = category.productCount || 0;

  return (
    <div className={`glass-card rounded-2xl border border-brand-border overflow-hidden ring-1 ${colors.ring} transition-shadow hover:shadow-lg hover:shadow-brand-purple/10`}>
      <div className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colors.from} ${colors.to} flex items-center justify-center shadow-lg shrink-0`}>
          <FolderTree className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-bold text-sm sm:text-base truncate">{category.name}</h3>
            {category.isCustom && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-purple/30 text-brand-purpleLight border border-brand-purple/50">
                Nova
              </span>
            )}
          </div>
          <p className="text-brand-muted text-xs mt-0.5 font-mono">{category.slug}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-card text-white text-xs font-bold border border-brand-border">
            <Package className="w-3.5 h-3.5 text-brand-purpleLight" />
            {count.toLocaleString("pt-BR")}
          </span>
          <Link
            to={`/categoria/${category.slug}`}
            target="_blank"
            className="p-2 rounded-xl text-brand-muted hover:text-white hover:bg-brand-card transition-colors"
            title="Ver categoria na loja"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
          {category.subcategories?.length > 0 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-2 rounded-xl text-brand-muted hover:text-white hover:bg-brand-card transition-colors"
              title="Ver subcategorias"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
      {expanded && category.subcategories?.length > 0 && (
        <div className="border-t border-brand-border px-5 py-3 bg-brand-dark/40">
          <p className="text-[10px] text-brand-muted font-bold uppercase tracking-wider mb-2">Subcategorias</p>
          <div className="flex flex-wrap gap-2">
            {category.subcategories.map(sub => (
              <span key={sub} className="px-2.5 py-1 rounded-lg bg-brand-card text-slate-300 text-xs border border-brand-border">
                {sub}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Form de criação de categoria
  const [newCategoryName, setNewCategoryName] = useState("");
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: "success" | "error", msg }

  const loadCategories = async () => {
    setLoading(true);
    try {
      const cats = await categoryService.getCategories();
      setCategories(cats);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("[AdminCategoriesPage] Erro ao carregar categorias:", err);
      setCategories(OFFICIAL_CATEGORIES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCategories(); }, []);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setFeedback({ type: "error", msg: "Informe o nome da categoria." });
      return;
    }

    setAdding(true);
    setFeedback(null);

    try {
      const created = await categoryService.addCategory(trimmed);
      setCategories(prev => [...prev, created]);
      setNewCategoryName("");
      setFeedback({ type: "success", msg: `Categoria "${created.name}" adicionada com sucesso!` });
    } catch (err) {
      setFeedback({ type: "error", msg: err.message || "Erro ao adicionar categoria." });
    } finally {
      setAdding(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const totalProducts = categories.reduce((acc, c) => acc + (c.productCount || 0), 0);

  return (
    <div className="space-y-8">
      {/* Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white">Categorias</h1>
          <p className="text-xs sm:text-sm text-brand-muted mt-1">
            {categories.length} categorias cadastradas — {totalProducts.toLocaleString("pt-BR")} produtos no catálogo.
          </p>
        </div>
        <button
          onClick={loadCategories}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-surface hover:bg-brand-card text-white text-xs font-bold border border-brand-border transition-all self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* Formulário: Criar Nova Categoria */}
      <div className="glass-card rounded-2xl p-5 border border-brand-border bg-gradient-to-r from-brand-surface via-brand-card to-brand-surface">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-brand-purpleLight" />
          Adicionar Nova Categoria
        </h2>
        <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Ex: Agasalhos & Corta-Ventos, Acessórios..."
            className="flex-1 bg-brand-dark border border-brand-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-brand-muted focus:outline-none focus:border-brand-purple"
          />
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-brand-purple hover:bg-brand-purpleLight text-white text-sm font-extrabold shadow-lg shadow-brand-purple/30 transition-all disabled:opacity-50 shrink-0"
          >
            {adding ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Adicionando...</>
            ) : (
              <><Plus className="w-4 h-4" /> Adicionar</>
            )}
          </button>
        </form>

        {/* Feedback do form */}
        {feedback && (
          <div className={`mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-medium ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}>
            {feedback.type === "success"
              ? <CheckCircle className="w-4 h-4 shrink-0" />
              : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{feedback.msg}</span>
          </div>
        )}
      </div>

      {/* Grid de Métricas */}
      <div className="glass-card rounded-2xl p-5 border border-brand-border grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="text-center">
          <p className="text-2xl font-display font-black text-white">{categories.length}</p>
          <p className="text-xs text-brand-muted mt-1">Categorias</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-display font-black text-brand-purpleLight">{totalProducts.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-brand-muted mt-1">Produtos</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-display font-black text-emerald-400">{categories.filter(c => (c.productCount || 0) > 0).length}</p>
          <p className="text-xs text-brand-muted mt-1">Com produtos</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-display font-black text-amber-400">{categories.reduce((acc, c) => acc + (c.subcategories?.length || 0), 0)}</p>
          <p className="text-xs text-brand-muted mt-1">Subcategorias</p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-brand-purple border-t-transparent animate-spin" />
            <p className="text-brand-muted text-sm">Carregando categorias…</p>
          </div>
        </div>
      )}

      {/* Lista de Categorias */}
      {!loading && (
        <div className="space-y-3">
          {categories.map(cat => <CategoryCard key={cat.slug} category={cat} />)}
        </div>
      )}

      {lastRefreshed && (
        <p className="text-center text-[11px] text-brand-muted">
          Atualizado às {lastRefreshed.toLocaleTimeString("pt-BR")} — Categorias oficiais e personalizadas sem duplicatas.
        </p>
      )}
    </div>
  );
}
