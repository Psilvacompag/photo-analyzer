# 📸 Photo Analyzer

Frontend moderno para curación de fotos con IA. Conectado a Google Apps Script + Google Drive.

## 🚀 Setup paso a paso

### Paso 1: Crear repo en GitHub

1. Andá a [github.com/new](https://github.com/new)
2. Nombre del repo: `photo-analyzer`
3. Dejalo **público** (necesario para GitHub Pages gratis)
4. **NO** marques "Add a README" (ya tenemos uno)
5. Click **Create repository**

### Paso 2: Subir el código

Abrí terminal en la carpeta del proyecto y ejecutá:

```bash
cd photo-analyzer
git init
git add .
git commit -m "🚀 Initial commit - Photo Analyzer"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/photo-analyzer.git
git push -u origin main
```

### Paso 3: Activar GitHub Pages

1. En tu repo, andá a **Settings** → **Pages** (menú izquierdo)
2. En **Source**, seleccioná **GitHub Actions**
3. ¡Listo! El workflow se ejecuta automáticamente

### Paso 4: Esperá el deploy

1. Andá a la pestaña **Actions** de tu repo
2. Vas a ver el workflow "Deploy to GitHub Pages" corriendo
3. Esperá ~2 minutos hasta que aparezca ✅ verde
4. Tu app está en: `https://TU_USUARIO.github.io/photo-analyzer/`

### Paso 5: Conectar con Google Apps Script (opcional)

Por defecto la app corre en **modo demo** con datos de ejemplo. 
Para conectarla con tus fotos reales:

1. En tu proyecto de GAS, agregá las funciones de `GAS_API_PATCH.gs`
2. Hacé un nuevo deploy de tu GAS como Web App
3. Copiá la URL del deploy (termina en `/exec`)
4. Creá un archivo `.env` en la raíz del proyecto:

```
VITE_GAS_URL=https://script.google.com/macros/s/AKfycbx.../exec
```

5. Commiteá y pusheá → se redeploya automáticamente

**⚠️ Nota sobre CORS:** GAS tiene un manejo especial de CORS con redirects. 
Si tenés problemas de CORS, la alternativa es usar JSONP o un proxy.

## 🛠️ Desarrollo local

```bash
npm install      # Instalar dependencias (solo la primera vez)
npm run dev      # Servidor de desarrollo en http://localhost:5173
npm run build    # Build para producción
```

## 📁 Estructura

```
photo-analyzer/
├── src/
│   ├── App.jsx          # Componente principal
│   ├── api.js           # Conexión con GAS backend
│   ├── demo-data.js     # Datos de demo
│   ├── index.css        # Estilos globales
│   └── main.jsx         # Entry point
├── .github/workflows/
│   └── deploy.yml       # Auto-deploy a GitHub Pages
├── GAS_API_PATCH.gs     # Patch para tu GAS existente
├── vite.config.js       # Config de Vite
└── package.json
```
