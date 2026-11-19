# Módulo Experimental de WhatsApp Web

Este proyecto es un módulo experimental y minimalista para visualizar conversaciones de WhatsApp dentro de una interfaz web en tiempo real, con un diseño inspirado en WhatsApp Web.

## Características

1. **Conexión mediante código QR**: Utiliza `whatsapp-web.js` para generar el código QR y autenticarse con WhatsApp.
2. **Estados de conexión**:
   - 🔴 **Desconectado**: Sin sesión activa, muestra botón de "Conectar".
   - 🟡 **Conectando**: Muestra modal interactivo con el código QR para escanear.
   - 🟢 **Conectado**: Muestra el usuario activo y habilita la visualización de chats.
3. **Lista de conversaciones**: Panel lateral izquierdo con nombres, últimos mensajes, hora y contador de mensajes no leídos.
4. **Buscador de chats**: Filtrado rápido de conversaciones.
5. **Panel de mensajes**: Panel derecho con diseño y colores de burbujas de WhatsApp (entrantes y salientes).
6. **Actualización en tiempo real**: Mediante WebSockets (`socket.io`), los mensajes nuevos (entrantes y salientes) y la lista de conversaciones se actualizan automáticamente sin recargar la página.
7. **Capa de Abstracción para Resúmenes con IA (`SummaryService`)**:
   - Botón *"Generar resumen"* en cada conversación activa.
   - Proveedor simulado (`MockSummaryProvider`) que devuelve temas, participantes, pendientes y fechas detectadas.
   - Arquitectura lista para conectar en el futuro **Google Gemini**, **OpenAI** o **Claude** sin tocar la interfaz ni la lógica existente.

## Estructura del Proyecto

```text
proyect2/
├── public/
│   ├── index.html     # Interfaz de usuario (página única estilo WhatsApp Web)
│   ├── style.css      # Estilos visuales acordes a la paleta de WhatsApp
│   └── app.js         # Lógica frontend y conexión Socket.io
├── services/
│   └── summary/
│       ├── SummaryProvider.js          # Interfaz / Clase base
│       ├── MockSummaryProvider.js      # Implementación simulada
│       ├── SummaryService.js           # Servicio desacoplado
│       ├── index.js                    # Exportación y singleton
│       └── providers/                  # Plantillas para Gemini, OpenAI, Claude
├── .env.example       # Plantilla de variables de entorno
├── .env               # Variables de entorno (API Keys - ignorado por Git)
├── server.js          # Servidor Express, cliente WhatsApp y WebSocket
├── package.json       # Dependencias y scripts
└── README.md          # Documentación
```

## Configuración de Inteligencia Artificial (Google Gemini)

El proyecto incluye integración directa con **Google Gemini** para resumir conversaciones:

1. Crea o abre tu archivo `.env` en la raíz del proyecto.
2. Agrega tu clave de API gratuita de [Google AI Studio](https://aistudio.google.com/app/apikey):
   ```env
   GEMINI_API_KEY=tu_api_key_aqui
   ```
3. Si no configuras la clave, el sistema automáticamente usará el proveedor simulado (`MockSummaryProvider`) sin que la aplicación falle.

## Requisitos Previos

- **Node.js** v18 o superior instalado en el equipo.
- Navegador web moderno (Chrome, Edge, Firefox, Safari).

## Instrucciones de Instalación y Ejecución

1. Abrir una terminal en el directorio del proyecto:
  

2. Instalar dependencias (si aún no se han instalado):
   ```bash
   npm install
   ```

3. Iniciar el servidor:
   ```bash
   npm start
   ```
   *(o `node server.js`)*

4. Abrir en el navegador:
   ```text
   http://localhost:3000
   ```

5. En la interfaz web:
   - Haz clic en el botón verde **"Conectar"** en la barra superior izquierda.
   - Aparecerá el modal con el código QR.
   - Desde tu teléfono: Abre **WhatsApp** > **Dispositivos vinculados** > **Vincular un dispositivo** y escanea el código QR de la pantalla.
   - Una vez vinculado, el indicador cambiará a 🟢 **Conectado**, se listarán tus conversaciones y podrás hacer clic en cualquiera de ellas para ver sus mensajes.
