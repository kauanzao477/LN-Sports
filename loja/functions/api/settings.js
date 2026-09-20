import { withDb } from '../_shared/db.js';
import { jsonResponse } from '../_shared/auth.js';

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequestGet(context) {
  const { env } = context;

  const DEFAULT = {
    storeName: env.VITE_STORE_NAME || 'LN SPORTS',
    whatsappNumber: env.VITE_STORE_WHATSAPP_NUMBER || '5549998046866',
    whatsappEnabled: true,
    defaultMessage: 'Olá! Gostaria de falar com um atendente da LN SPORTS.',
    productMessageTemplate: 'Olá! Tenho interesse neste produto:\nProduto: {productName}\nLink: {productUrl}\nGostaria de saber mais informações com um atendente.',
    instagramUrl: env.VITE_STORE_INSTAGRAM_URL || 'https://www.instagram.com/ln.sportsss/',
    announcementText: '🚀 Catálogo Oficial LN SPORTS — Envio para todo o Brasil via Atendimento Exclusivo no WhatsApp',
  };

  try {
    const settings = await withDb(env, async (client) => {
      const { rows } = await client.query('SELECT * FROM store_settings WHERE id = 1');
      if (!rows.length) return DEFAULT;
      const r = rows[0];
      return {
        storeName: r.store_name || DEFAULT.storeName,
        whatsappNumber: r.whatsapp_number || DEFAULT.whatsappNumber,
        whatsappEnabled: r.whatsapp_enabled !== false,
        defaultMessage: r.default_message || DEFAULT.defaultMessage,
        productMessageTemplate: r.product_message_template || DEFAULT.productMessageTemplate,
        instagramUrl: r.instagram_url || DEFAULT.instagramUrl,
        announcementText: r.announcement_text || DEFAULT.announcementText,
      };
    });
    return jsonResponse(settings);
  } catch (err) {
    console.warn('[Pages Functions GET /api/settings] Using default settings fallback:', err.message);
    return jsonResponse(DEFAULT);
  }
}
