import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Cambiá 'photo-analyzer' por el nombre de tu repo en GitHub
  base: '/photo-analyzer/',
})
