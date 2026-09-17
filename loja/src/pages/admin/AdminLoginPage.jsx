import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/admin';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Erro ao realizar login administrativo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Glow roxo de fundo */}
      <div className="absolute w-[500px] h-[500px] bg-brand-purple/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Voltar para loja */}
      <Link
        to="/"
        className="absolute top-6 left-6 inline-flex items-center gap-2 text-xs font-semibold text-brand-muted hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar ao Catálogo</span>
      </Link>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-purple to-brand-purpleLight p-0.5 mx-auto mb-4 shadow-xl shadow-brand-purple/40">
            <div className="w-full h-full bg-brand-dark rounded-[14px] flex items-center justify-center font-display font-black text-brand-purpleLight text-2xl">
              LN
            </div>
          </div>
          <h1 className="font-display font-black text-2xl text-white">
            Painel Administrativo
          </h1>
          <p className="text-xs text-brand-muted mt-1 uppercase tracking-widest font-bold">
            LN SPORTS • Acesso Restrito
          </p>
        </div>

        {/* Card do Formulário */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 border border-brand-border/80 shadow-2xl">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                E-mail do Administrador
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-brand-muted absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="lourenzo.brando@lnsports.com.br"
                  className="w-full bg-brand-surface border border-brand-border text-white text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-brand-muted absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-brand-surface border border-brand-border text-white text-sm rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-purple to-brand-purpleLight hover:from-brand-purpleLight hover:to-brand-purple text-white text-sm font-extrabold tracking-wide uppercase shadow-lg shadow-brand-purple/30 transition-all duration-200 mt-2 disabled:opacity-50"
            >
              {submitting ? 'Verificando...' : 'Entrar no Painel'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-brand-border/60 text-center">
            <p className="text-[11px] text-brand-muted">
              Ambiente protegido. Operações administrativas são registradas para auditoria.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
