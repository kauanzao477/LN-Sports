/**
 * Serviço de Configurações da Loja LN SPORTS.
 * Consome /api/settings do server.js (Node/Express + PostgreSQL).
 * Fallback para localStorage e variáveis de ambiente.
 */

const DEFAULT_SETTINGS = {
  storeName: import.meta.env.VITE_STORE_NAME || 'LN SPORTS',
  whatsappNumber: import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '5549998046866',
  whatsappEnabled: true,
  defaultMessage: 'Olá! Gostaria de falar com um atendente da LN SPORTS.',
  productMessageTemplate: 'Olá! Tenho interesse neste produto:\nProduto: {productName}\nLink: {productUrl}\nGostaria de saber mais informações com um atendente.',
  instagramUrl: 'https://www.instagram.com/ln.sportsss/',
  announcementText: '🚀 Catálogo Oficial LN SPORTS — Envio para todo o Brasil via Atendimento Exclusivo no WhatsApp'
};

function getLocalSettings() {
  try {
    const saved = localStorage.getItem('ln_sports_settings');
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch (e) {}
  return DEFAULT_SETTINGS;
}

function saveLocalSettings(settings) {
  try {
    localStorage.setItem('ln_sports_settings', JSON.stringify(settings));
  } catch (e) {}
}

// Obtém token JWT do admin (se estiver logado)
function getAuthHeaders() {
  const token = sessionStorage.getItem('ln_sports_admin_token');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export const settingsService = {
  /**
   * Obtém as configurações da loja.
   * Fonte primária: GET /api/settings
   * Fallback: localStorage → defaults de .env
   */
  async getSettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        // Cache local para acesso offline
        saveLocalSettings(data);
        return { ...DEFAULT_SETTINGS, ...data };
      }
    } catch (err) {
      console.warn('[settingsService] API indisponível, usando fallback local:', err.message);
    }
    return getLocalSettings();
  },

  /**
   * Salva configurações da loja (admin).
   * Primário: PUT /api/admin/settings
   * Fallback: localStorage
   */
  async saveSettings(newSettings) {
    const merged = { ...DEFAULT_SETTINGS, ...newSettings };

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(merged),
      });
      if (res.ok) {
        saveLocalSettings(merged);
        return merged;
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    } catch (err) {
      console.error('[settingsService] Erro ao salvar settings:', err.message);
    }

    saveLocalSettings(merged);
    return merged;
  },
};
