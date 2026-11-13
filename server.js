const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Estado de la conexión
// 'disconnected' | 'connecting' | 'connected'
let connectionState = {
    status: 'disconnected',
    qrCode: null,
    info: null
};

let client = null;

/**
 * Normaliza y formatea un objeto de mensaje para el frontend
 */
function formatMessage(msg) {
    return {
        id: msg.id ? (msg.id._serialized || msg.id.id) : String(Date.now()),
        chatId: msg.fromMe ? msg.to : msg.from,
        from: msg.from,
        to: msg.to,
        fromMe: msg.fromMe,
        body: msg.body || (msg.hasMedia ? '[Archivo multimedia]' : ''),
        type: msg.type,
        timestamp: msg.timestamp ? msg.timestamp * 1000 : Date.now(),
        author: msg.author || null
    };
}

/**
 * Normaliza y formatea la lista de chats para el frontend
 */
async function formatChats(rawChats) {
    return rawChats.map(chat => {
        let lastMessageText = '';
        let lastMessageTime = null;

        if (chat.lastMessage) {
            lastMessageText = chat.lastMessage.body || (chat.lastMessage.hasMedia ? '[Multimedia]' : '');
            if (chat.lastMessage.timestamp) {
                lastMessageTime = chat.lastMessage.timestamp * 1000;
            }
        }

        return {
            id: chat.id._serialized,
            name: chat.name || chat.formattedTitle || chat.id.user || 'Desconocido',
            isGroup: chat.isGroup,
            unreadCount: chat.unreadCount || 0,
            timestamp: lastMessageTime || (chat.timestamp ? chat.timestamp * 1000 : Date.now()),
            lastMessage: lastMessageText
        };
    }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

/**
 * Inicializa el cliente de WhatsApp
 */
function initWhatsAppClient() {
    if (client) {
        console.log('Cliente ya inicializado o en proceso.');
        return;
    }

    console.log('Iniciando cliente de WhatsApp...');
    connectionState.status = 'connecting';
    connectionState.qrCode = null;
    delete connectionState.message;
    io.emit('status_change', connectionState);

    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: path.join(__dirname, '.wwebjs_auth')
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });

    // Evento: Generación de código QR
    client.on('qr', async (qr) => {
        console.log('Código QR recibido');
        try {
            const qrDataUrl = await qrcode.toDataURL(qr, { width: 280, margin: 2 });
            connectionState.status = 'connecting';
            connectionState.qrCode = qrDataUrl;
            delete connectionState.message;
            io.emit('status_change', connectionState);
        } catch (err) {
            console.error('Error generando imagen QR:', err);
            connectionState.status = 'connecting';
            connectionState.qrCode = null;
            connectionState.message = 'No se pudo generar el código QR. Intenta conectar de nuevo.';
            io.emit('status_change', connectionState);
        }
    });

    // Evento: Autenticado
    client.on('authenticated', () => {
        console.log('Cliente autenticado correctamente');
        connectionState.status = 'connecting';
        connectionState.qrCode = null;
        io.emit('status_change', { ...connectionState, message: 'Autenticado. Cargando datos...' });
    });

    // Evento: Listo / Conectado
    client.on('ready', async () => {
        console.log('WhatsApp Web está listo y conectado!');
        connectionState.status = 'connected';
        connectionState.qrCode = null;
        connectionState.info = client.info ? {
            wid: client.info.wid ? client.info.wid._serialized : null,
            pushname: client.info.pushname || 'Usuario'
        } : null;

        io.emit('status_change', connectionState);

        // Notificar y cargar conversaciones iniciales
        try {
            const rawChats = await client.getChats();
            const formatted = await formatChats(rawChats);
            io.emit('chats_list', formatted);
        } catch (err) {
            console.error('Error al obtener conversaciones iniciales:', err);
        }
    });

    // Evento: Fallo de autenticación
    client.on('auth_failure', (msg) => {
        console.error('Fallo de autenticación:', msg);
        connectionState.status = 'disconnected';
        connectionState.qrCode = null;
        connectionState.info = null;
        io.emit('status_change', { ...connectionState, error: 'Fallo al autenticar' });
        client = null;
    });

    // Evento: Desconectado
    client.on('disconnected', (reason) => {
        console.log('Cliente desconectado:', reason);
        connectionState.status = 'disconnected';
        connectionState.qrCode = null;
        connectionState.info = null;
        io.emit('status_change', connectionState);
        client = null;
    });

    // Evento: Nuevo mensaje (recibido o enviado por el usuario)
    client.on('message_create', async (msg) => {
        try {
            const formattedMsg = formatMessage(msg);
            io.emit('new_message', formattedMsg);

            // Refrescar y emitir lista de chats actualizada para reflejar orden y último mensaje
            const rawChats = await client.getChats();
            const formatted = await formatChats(rawChats);
            io.emit('chats_list', formatted);
        } catch (err) {
            console.error('Error procesando nuevo mensaje:', err);
        }
    });

    client.initialize().catch(err => {
        console.error('Error al inicializar cliente:', err);
        connectionState.status = 'disconnected';
        connectionState.qrCode = null;
        io.emit('status_change', { ...connectionState, error: err.message });
        client = null;
    });
}

// Configuración de WebSockets con Socket.io
io.on('connection', async (socket) => {
    console.log('Nuevo cliente web conectado a socket');

    // Enviar estado actual de inmediato
    socket.emit('status_change', connectionState);

    // Si ya está conectado, enviar lista de chats
    if (client && connectionState.status === 'connected') {
        try {
            const rawChats = await client.getChats();
            const formatted = await formatChats(rawChats);
            socket.emit('chats_list', formatted);
        } catch (err) {
            console.error('Error al enviar chats al nuevo socket:', err);
        }
    }

    // Solicitar iniciar conexión si está desconectado
    socket.on('start_connection', () => {
        if (connectionState.status === 'disconnected') {
            initWhatsAppClient();
        }
    });

    // Solicitar refrescar lista de conversaciones
    socket.on('get_chats', async () => {
        if (!client || connectionState.status !== 'connected') {
            return socket.emit('chats_list', []);
        }
        try {
            const rawChats = await client.getChats();
            const formatted = await formatChats(rawChats);
            socket.emit('chats_list', formatted);
        } catch (err) {
            console.error('Error obteniendo chats:', err);
            socket.emit('error_message', 'No se pudieron obtener las conversaciones');
        }
    });

    // Solicitar mensajes de una conversación
    socket.on('get_messages', async (chatId) => {
        if (!client || connectionState.status !== 'connected') {
            return socket.emit('messages_list', { chatId, messages: [] });
        }
        try {
            const chat = await client.getChatById(chatId);
            const messages = await chat.fetchMessages({ limit: 50 });
            const formattedMessages = messages.map(formatMessage);
            socket.emit('messages_list', { chatId, messages: formattedMessages });
        } catch (err) {
            console.error(`Error obteniendo mensajes para ${chatId}:`, err);
            socket.emit('messages_list', { chatId, messages: [] });
        }
    });

    // Desconectar sesión manualmente
    socket.on('disconnect_session', async () => {
        if (client) {
            try {
                await client.logout();
            } catch (e) {
                console.warn('Error al hacer logout:', e.message);
            }
            try {
                await client.destroy();
            } catch (e) {
                console.warn('Error al destruir cliente:', e.message);
            }
            client = null;
        }
        connectionState.status = 'disconnected';
        connectionState.qrCode = null;
        connectionState.info = null;
        io.emit('status_change', connectionState);
    });
});

// Rutas API REST alternativas de apoyo
app.get('/api/status', (req, res) => {
    res.json(connectionState);
});

server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(` Servidor de WhatsApp Web iniciado en puerto ${PORT}`);
    console.log(` Abre http://localhost:${PORT} en tu navegador`);
    console.log(`===============================================`);
});
