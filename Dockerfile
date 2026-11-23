# Imagen base oficial de Node.js en Debian Bookworm (estable y con soporte nativo de Chromium)
FROM node:20-bookworm-slim

# Instalar Chromium oficial de los repositorios de Debian (sin repositorios externos que puedan fallar)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Variables de entorno para Puppeteer y Node
ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PORT=3000

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm install --omit=dev --no-audit

# Copiar el código fuente
COPY . .

# Exponer el puerto
EXPOSE 3000

# Iniciar la aplicación
CMD ["npm", "start"]
