/**
 * Serviço de Configurações da Loja LN SPORTS.
 * Gerencia o documento settings/store no Firestore (número WhatsApp, mensagens, nome).
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

const DEFAULT_SETTINGS = {
  storeName: import.meta.env.VITE_STORE_NAME || 'LN SPORTS',
  whatsappNumber: import.meta.env.VITE_STORE_WHATSAPP_NUMBER || '5511999999999',
  whatsappEnabled: true,
  defaultMessage: 'Olá! Gostaria de falar com um atendente da LN SPORTS.',
  productMessageTemplate: 'Olá! Tenho interesse neste produto:\nProduto: {productName}\nLink: {productUrl}\nGostaria de saber mais informações com um atendente.',
  instagramUrl: 'https://instagram.com/lnsports',
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

export const settingsService = {
  /**
   * Obtém as configurações oficiais da loja.
   */
  async getSettings() {
    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'settings', 'store');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return { ...DEFAULT_SETTINGS, ...docSnap.data() };
        }
      } catch (error) {
        console.warn("[settingsService] Fallback para configurações locais:", error.message);
      }
    }
    return getLocalSettings();
  },

  /**
   * Salva as configurações oficiais no Firestore.
   */
  async saveSettings(newSettings) {
    const merged = { ...DEFAULT_SETTINGS, ...newSettings, updatedAt: new Date().toISOString() };

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(db, 'settings', 'store');
        await setDoc(docRef, merged, { merge: true });
        return merged;
      } catch (error) {
        console.error("[settingsService] Erro ao gravar configurações no Firestore:", error);
      }
    }

    saveLocalSettings(merged);
    return merged;
  }
};
