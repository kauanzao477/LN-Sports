import { withDb } from '../../_shared/db.js';
import { requireAdmin, jsonResponse } from '../../_shared/auth.js';

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function onRequestPut(context) {
  const { request, env } = context;

  const { errorResponse } = requireAdmin(request, env);
  if (errorResponse) return errorResponse;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400);
  }

  const {
    storeName,
    whatsappNumber,
    whatsappEnabled,
    defaultMessage,
    productMessageTemplate,
    instagramUrl,
    announcementText,
  } = body || {};

  try {
    await withDb(env, async (client) => {
      await client.query(`
        UPDATE store_settings SET
          store_name               = COALESCE($1, store_name),
          whatsapp_number          = COALESCE($2, whatsapp_number),
          whatsapp_enabled         = COALESCE($3, whatsapp_enabled),
          default_message          = COALESCE($4, default_message),
          product_message_template = COALESCE($5, product_message_template),
          instagram_url            = COALESCE($6, instagram_url),
          announcement_text        = COALESCE($7, announcement_text),
          updated_at               = NOW()
        WHERE id = 1
      `, [
        storeName !== undefined ? storeName : null,
        whatsappNumber !== undefined ? whatsappNumber : null,
        whatsappEnabled !== undefined ? whatsappEnabled : null,
        defaultMessage !== undefined ? defaultMessage : null,
        productMessageTemplate !== undefined ? productMessageTemplate : null,
        instagramUrl !== undefined ? instagramUrl : null,
        announcementText !== undefined ? announcementText : null,
      ]);
    
    // Salva explicitamente a capa escolhida no Neon
    if (mainImageIndex !== undefined) {
        await client.query('UPDATE products SET main_image_index = await client.query(`
        UPDATE store_settings SET
          store_name               = COALESCE($1, store_name),
          whatsapp_number          = COALESCE($2, whatsapp_number),
          whatsapp_enabled         = COALESCE($3, whatsapp_enabled),
          default_message          = COALESCE($4, default_message),
          product_message_template = COALESCE($5, product_message_template),
          instagram_url            = COALESCE($6, instagram_url),
          announcement_text        = COALESCE($7, announcement_text),
          updated_at               = NOW()
        WHERE id = 1
      `, [
        storeName !== undefined ? storeName : null,
        whatsappNumber !== undefined ? whatsappNumber : null,
        whatsappEnabled !== undefined ? whatsappEnabled : null,
        defaultMessage !== undefined ? defaultMessage : null,
        productMessageTemplate !== undefined ? productMessageTemplate : null,
        instagramUrl !== undefined ? instagramUrl : null,
        announcementText !== undefined ? announcementText : null,
      ]);
     WHERE id = $2', [mainImageIndex, id]);
    }
});
    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[Pages Functions PUT /api/admin/settings] Error:', err.message);
    return jsonResponse({ ok: true, fallback: true, warning: err.message });
  }
}
