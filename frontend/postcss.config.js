import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// __dirname apunta a frontend/ — garantiza que Tailwind encuentre
// su config independientemente del CWD del proceso Node
const __dirname = dirname(fileURLToPath(import.meta.url))

export default {
  plugins: {
    tailwindcss: { config: resolve(__dirname, 'tailwind.config.js') },
    autoprefixer: {},
  },
}
