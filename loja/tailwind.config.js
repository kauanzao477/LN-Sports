/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#080511',       // Preto profundo com matiz roxo escuro
          surface: '#120c24',    // Superfície roxa bem escura
          card: '#1b1236',       // Fundo de cartões
          cardHover: '#231845',  // Hover de cartões
          border: '#33235f',     // Bordas sutis roxas
          borderLight: '#4c358a',
          purple: '#9333ea',     // Roxo principal
          purpleLight: '#a855f7',// Roxo vibrante
          purpleNeon: '#c084fc', // Roxo neon para destaques
          violet: '#7c3aed',     // Violeta atlético
          whatsapp: '#25D366',   // Verde oficial WhatsApp para máxima conversão
          whatsappHover: '#1ebe5d',
          muted: '#a19cb8',      // Texto secundário legível
          light: '#f3f0fa'       // Texto claro de alto contraste
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif']
      },
      boxShadow: {
        'purple-glow': '0 0 25px -5px rgba(147, 51, 234, 0.4)',
        'purple-glow-lg': '0 0 40px -10px rgba(168, 85, 247, 0.5)',
        'card': '0 10px 30px -10px rgba(0, 0, 0, 0.7)'
      }
    },
  },
  plugins: [],
}
