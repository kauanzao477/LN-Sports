/**
 * Inicialização centralizada do Firebase (Auth & Cloud Firestore).
 * Inclui detecção de ambiente e fallback demonstrativo para permitir navegação imediata.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Verifica se as credenciais reais foram informadas no .env
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'sua_api_key_aqui' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'seu_projeto_id'
);

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error("[Firebase] Erro ao inicializar Firebase SDK:", error);
  }
} else {
  console.info(
    "%c[LN-Sports]%c Firebase rodando em modo demonstração local. Configure seu .env com as chaves do Firebase Console para sincronizar com o Cloud Firestore real.",
    "color: #00f59b; font-weight: bold;",
    "color: #94a3b8;"
  );
}

export { app, auth, db };
