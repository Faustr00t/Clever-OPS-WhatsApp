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

## Estructura del Proyecto

```text
proyect2/
├── public/
│   ├── index.html     # Interfaz de usuario (página única estilo WhatsApp Web)
│   ├── style.css      # Estilos visuales acordes a la paleta de WhatsApp
│   └── app.js         # Lógica frontend y conexión Socket.io
├── server.js          # Servidor Express, cliente WhatsApp y WebSocket
├── package.json       # Dependencias y scripts
└── README.md          # Documentación
```

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
