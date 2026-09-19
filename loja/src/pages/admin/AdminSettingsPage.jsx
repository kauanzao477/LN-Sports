import React, { useState, useEffect } from "react";
import {
  Settings,
  MessageCircle,
  Instagram,
  Bell,
  Save,
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from "lucide-react";

const DEFAULT_SETTINGS = {
  storeName: "LN SPORTS",
  whatsappNumber: "5549998046866",
  whatsappEnabled: true,
  defaultMessage: "Ola! Gostaria de falar com um atendente da LN SPORTS.",
  productMessageTemplate: "Ola! Tenho interesse neste produto:\nProduto: {productName}\nLink: {productUrl}\nGostaria de saber mais informacoes.",
  instagramUrl: "https://www.instagram.com/ln.sportsss/",
  announcementText: "Catalogo Oficial LN SPORTS - Envio para todo o Brasil via WhatsApp",
};

function SettingSection({ icon: Icon, title, children }) {
  return (
    <div className="glass-card rounded-2xl border border-brand-border overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-brand-border bg-brand-dark/40">
        <div className="w-8 h-8 rounded-xl bg-brand-purple/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-brand-purpleLight" />
        </div>
        <h2 className="font-bold text-white text-sm">{title}</h2>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-brand-muted">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full bg-brand-dark border border-brand-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-purple/50 focus:border-brand-purple transition-colors";

export function AdminSettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: "success"|"error", msg }

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.warn("[AdminSettingsPage] Erro ao carregar:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (key) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setSettings(prev => ({ ...prev, [key]: val }, []));
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const token = sessionStorage.getItem("ln_sports_admin_token");
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setFeedback({ type: "success", msg: "Configuracoes salvas com sucesso!" });
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({ type: "error", msg: err.error || "Erro ao salvar. Verifique a conexao com o servidor." });
      }
    } catch (err) {
      setFeedback({ type: "error", msg: "Servidor indisponivel. As configuracoes sao gerenciadas localmente." });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-brand-purple border-t-transparent animate-spin" />
          <p className="text-brand-muted text-sm">Carregando configuracoes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white">Configuracoes</h1>
          <p className="text-xs sm:text-sm text-brand-muted mt-1">
            Personalize as informacoes da loja, atendimento e integracao.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-surface hover:bg-brand-card text-white text-xs font-bold border border-brand-border transition-all self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Recarregar
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
          feedback.type === "success"
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            : "bg-rose-500/10 border-rose-500/30 text-rose-400"
        }`}>
          {feedback.type === "success"
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {feedback.msg}
        </div>
      )}

      {/* Loja */}
      <SettingSection icon={Settings} title="Informacoes da Loja">
        <Field label="Nome da Loja" hint="Exibido no cabecalho e no painel admin.">
          <input
            type="text"
            value={settings.storeName || ""}
            onChange={handleChange("storeName")}
            placeholder="LN SPORTS"
            className={inputCls}
            id="settings-store-name"
          />
        </Field>

        <Field label="Texto do Aviso (Banner)" hint="Mensagem exibida na faixa de anuncio no topo da loja.">
          <textarea
            value={settings.announcementText || ""}
            onChange={handleChange("announcementText")}
            rows={2}
            placeholder="Ex: Frete gratis para todo o Brasil..."
            className={`${inputCls} resize-none`}
            id="settings-announcement"
          />
        </Field>
      </SettingSection>

      {/* WhatsApp */}
      <SettingSection icon={MessageCircle} title="WhatsApp">
        <div className="flex items-center justify-between p-3 rounded-xl bg-brand-dark border border-brand-border">
          <div>
            <p className="text-sm font-semibold text-white">Atendimento via WhatsApp</p>
            <p className="text-xs text-brand-muted">Exibe o botao de WhatsApp nos produtos.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={!!settings.whatsappEnabled}
              onChange={handleChange("whatsappEnabled")}
              className="sr-only peer"
              id="settings-whatsapp-enabled"
            />
            <div className="w-11 h-6 bg-brand-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-purple" />
          </label>
        </div>

        <Field label="Numero do WhatsApp" hint="Apenas numeros com DDD e DDI. Ex: 5549998046866">
          <input
            type="text"
            value={settings.whatsappNumber || ""}
            onChange={handleChange("whatsappNumber")}
            placeholder="5549998046866"
            className={inputCls}
            id="settings-whatsapp-number"
          />
        </Field>

        <Field label="Mensagem Padrao" hint="Mensagem enviada quando o cliente clica em 'Falar no WhatsApp' sem produto especifico.">
          <textarea
            value={settings.defaultMessage || ""}
            onChange={handleChange("defaultMessage")}
            rows={3}
            className={`${inputCls} resize-none`}
            id="settings-default-message"
          />
        </Field>

        <Field
          label="Template de Mensagem do Produto"
          hint="Use {productName} e {productUrl} como variaveis."
        >
          <textarea
            value={settings.productMessageTemplate || ""}
            onChange={handleChange("productMessageTemplate")}
            rows={4}
            className={`${inputCls} resize-none`}
            id="settings-product-message"
          />
        </Field>
      </SettingSection>

      {/* Instagram */}
      <SettingSection icon={Instagram} title="Redes Sociais">
        <Field label="URL do Instagram" hint="Link do perfil oficial da loja no Instagram.">
          <input
            type="url"
            value={settings.instagramUrl || ""}
            onChange={handleChange("instagramUrl")}
            placeholder="https://www.instagram.com/ln.sportsss/"
            className={inputCls}
            id="settings-instagram-url"
          />
        </Field>
      </SettingSection>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          id="settings-save-btn"
          className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-brand-purple hover:bg-brand-purpleLight text-white text-sm font-extrabold shadow-lg shadow-brand-purple/30 transition-all hover:scale-102 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Salvando...</>
            : <><Save className="w-4 h-4" /> Salvar Configuracoes</>
          }
        </button>
      </div>
    </div>
  );
}
