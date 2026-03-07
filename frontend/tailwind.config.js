import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Normalizar a forward slashes para que Tailwind interprete los globs en Windows
const r = (...p) => resolve(__dirname, ...p).replace(/\\/g, '/')

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    r('index.html'),
    r('src/**/*.{js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        // Paleta corporativa HealthTech
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#1d4ed8',
          600: '#1e40af',
          700: '#1e3a8a',
          900: '#1e3a8a',
        },
        // Estados clínicos
        triage: {
          rojo:    '#dc2626',  // Nivel 1 — Inmediato
          naranja: '#ea580c',  // Nivel 2 — Urgente
          amarillo:'#ca8a04',  // Nivel 3 — Semi-urgente
          verde:   '#16a34a',  // Nivel 4 — Menos urgente
          azul:    '#2563eb',  // Nivel 5 — No urgente
        },
        // Estado de camas
        cama: {
          disponible:   '#16a34a',
          ocupada:      '#dc2626',
          mantenimiento:'#ca8a04',
          reservada:    '#7c3aed',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      // Dimensiones para layouts médicos (dashboard de camas, etc.)
      gridTemplateColumns: {
        'camas-4': 'repeat(4, minmax(0, 1fr))',
        'camas-6': 'repeat(6, minmax(0, 1fr))',
        'camas-8': 'repeat(8, minmax(0, 1fr))',
      },
    },
  },
  plugins: [],
}
