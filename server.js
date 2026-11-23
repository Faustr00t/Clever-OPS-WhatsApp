require('dotenv').config();
const express = require('express');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const { summaryService } = require('./services/summary');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 12 * 1024 * 1024 });

const PORT = process.env.PORT || 3000;
// shortcut: archivos de hasta 8 MB; para archivos mayores, migrar a carga HTTP por streaming.
const MAX_MEDIA_SIZE = 8 * 1024 * 1024;
const authDataPath = path.join(__dirname, '.wwebjs_auth');
const authSessionPath = path.join(authDataPath, 'session');
const instanceLockPath = path.join(authDataPath, 'instance.lock');
let ownsInstanceLock = false;

class SessionSafeLocalAuth extends LocalAuth {
    // Se elimina el perfil desde la app después de cerrar Chromium.
    async logout() {}
}

function acquireInstanceLock() {
    fs.mkdirSync(path.dirname(instanceLockPath), { recursive: true });
    try {
        fs.writeFileSync(instanceLockPath, String(process.pid), { flag: 'wx' });
        ownsInstanceLock = true;
        return true;
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
        let pid;
        try {
            pid = Number(fs.readFileSync(instanceLockPath, 'utf8'));
        } catch (readError) {
            if (readError.code === 'ENOENT') return acquireInstanceLock();
            throw readError;
        }
        if (!Number.isSafeInteger(pid) || pid < 1) return false;
        try {
            process.kill(pid, 0);
            return false;
        } catch (processError) {
            if (processError.code !== 'ESRCH') throw processError;
            const recoveryPath = `${instanceLockPath}.recovery`;
            try {
                fs.mkdirSync(recoveryPath);
            } catch (recoveryError) {
                if (recoveryError.code === 'EEXIST') return false;
                throw recoveryError;
            }
            try {
                if (Number(fs.readFileSync(instanceLockPath, 'utf8')) !== pid) return false;
                try {
                    process.kill(pid, 0);
                    return false;
                } catch (ownerError) {
                    if (ownerError.code !== 'ESRCH') throw ownerError;
                    fs.unlinkSync(instanceLockPath);
                }
            } finally {
                fs.rmdirSync(recoveryPath);
            }
            return acquireInstanceLock();
        }
    }
}

function releaseInstanceLock() {
    if (!ownsInstanceLock) return;
    try {
        if (fs.readFileSync(instanceLockPath, 'utf8') === String(process.pid)) fs.unlinkSync(instanceLockPath);
    } catch (err) {
        if (err.code !== 'ENOENT') console.error('No se pudo liberar el bloqueo de WhatsApp:', err);
    }
    ownsInstanceLock = false;
}

process.once('exit', releaseInstanceLock);

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
let closingClient = false;
let chatRefreshTimer = null;

/**
 * Resuelve de forma inteligente el nombre legible de un chat o contacto,
 * evitando identificadores internos como @lid o IDs numéricos anónimos.
 */
async function resolveChatDisplayName(chat) {
    let name = chat.name || chat.formattedTitle || '';

    // Si el nombre contiene @lid, es puramente numérico o está vacío
    const isLid = !name || name.includes('@lid') || (chat.id && chat.id._serialized && chat.id._serialized.includes('@lid'));

    if (isLid || !name || name === chat.id?.user) {
        try {
            // Intentar obtener el objeto Contacto de WhatsApp para extraer pushname o número
            const contact = await chat.getContact().catch(() => null);
            if (contact) {
                name = contact.name || contact.pushname || contact.formattedNumber || contact.number || '';
            }
        } catch (_) {
            // Fallback silencioso si no se puede resolver el contacto
        }
    }

    // Si aún contiene @lid o es una cadena numérica larga de LID
    if (!name || name.includes('@lid') || (/^\d{12,}$/.test(name) && chat.id?._serialized?.includes('@lid'))) {
        if (chat.isGroup) {
            name = (chat.name && !chat.name.includes('@lid')) ? chat.name : 'Grupo de WhatsApp';
        } else if (chat.id?.server === 'c.us' && chat.id?.user) {
            // Número telefónico tradicional pero sin nombre en agenda
            name = `+${chat.id.user}`;
        } else {
            name = 'Usuario de WhatsApp';
        }
    }

    return name;
}

/**
 * Normaliza y formatea un objeto de mensaje para el frontend
 */
function formatMessage(msg) {
    let authorName = msg.author || null;

    // Si el autor es un identificador @lid, intentar usar el nombre público (notifyName)
    if (authorName && authorName.includes('@lid')) {
        authorName = msg._data?.notifyName || null;
    } else if (authorName && authorName.includes('@c.us')) {
        const userNumber = authorName.split('@')[0];
        authorName = msg._data?.notifyName || `+${userNumber}`;
    }

    return {
        id: msg.id ? (msg.id._serialized || msg.id.id) : String(Date.now()),
        chatId: msg.fromMe ? msg.to : msg.from,
        from: msg.from,
        to: msg.to,
        fromMe: msg.fromMe,
        body: msg.body || (msg.hasMedia ? '[Archivo multimedia]' : ''),
        hasMedia: msg.hasMedia,
        mediaFilename: msg._data?.filename || null,
        type: msg.type,
        timestamp: msg.timestamp ? msg.timestamp * 1000 : Date.now(),
        author: authorName
    };
}

/**
 * Normaliza y formatea la lista de chats para el frontend
 */
async function formatChats(rawChats) {
    const formatted = await Promise.all(rawChats.map(async (chat) => {
        let lastMessageText = '';
        let lastMessageTime = null;

        if (chat.lastMessage) {
            lastMessageText = chat.lastMessage.body || (chat.lastMessage.hasMedia ? '[Multimedia]' : '');
            if (chat.lastMessage.timestamp) {
                lastMessageTime = chat.lastMessage.timestamp * 1000;
            }
        }

        const resolvedName = await resolveChatDisplayName(chat);

        return {
            id: chat.id._serialized,
            name: resolvedName,
            isGroup: chat.isGroup,
            unreadCount: chat.unreadCount || 0,
            timestamp: lastMessageTime || (chat.timestamp ? chat.timestamp * 1000 : Date.now()),
            lastMessage: lastMessageText
        };
    }));

    return formatted.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

function scheduleChatListRefresh(whatsappClient) {
    clearTimeout(chatRefreshTimer);
    chatRefreshTimer = setTimeout(async () => {
        if (client !== whatsappClient || connectionState.status !== 'connected') return;
        try {
            const formatted = await formatChats(await whatsappClient.getChats());
            if (client === whatsappClient && connectionState.status === 'connected') io.emit('chats_list', formatted);
        } catch (err) {
            console.error('Error actualizando conversaciones:', err);
        }
    }, 250);
}

/**
 * Inicializa el cliente de WhatsApp
 */
function initWhatsAppClient() {
    if (client || closingClient) {
        console.log('Cliente ya inicializado, en proceso o cerrándose.');
        return;
    }

    try {
        if (!acquireInstanceLock()) {
            connectionState.status = 'disconnected';
            connectionState.message = 'WhatsApp ya está abierto en otra instancia. Ciérrala antes de volver a conectar.';
            io.emit('status_change', connectionState);
            return;
        }
    } catch (err) {
        console.error('No se pudo bloquear la sesión de WhatsApp:', err);
        connectionState.status = 'disconnected';
        connectionState.error = err.message;
        io.emit('status_change', connectionState);
        return;
    }

    console.log('Iniciando cliente de WhatsApp...');
    connectionState.status = 'connecting';
    connectionState.qrCode = null;
    delete connectionState.message;
    io.emit('status_change', connectionState);

    const whatsappClient = client = new Client({
        authStrategy: new SessionSafeLocalAuth({
            dataPath: authDataPath
        }),
        puppeteer: {
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-default-apps',
                '--mute-audio'
            ]
        }
    });

    // Evento: Generación de código QR
    whatsappClient.on('qr', async (qr) => {
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
    whatsappClient.on('authenticated', () => {
        console.log('Cliente autenticado correctamente');
        connectionState.status = 'connecting';
        connectionState.qrCode = null;
        io.emit('status_change', { ...connectionState, message: 'Autenticado. Cargando datos...' });
    });

    // Evento: Listo / Conectado
    whatsappClient.on('ready', async () => {
        console.log('WhatsApp Web está listo y conectado!');
        connectionState.status = 'connected';
        connectionState.qrCode = null;
        connectionState.info = whatsappClient.info ? {
            wid: whatsappClient.info.wid ? whatsappClient.info.wid._serialized : null,
            pushname: whatsappClient.info.pushname || 'Usuario'
        } : null;

        io.emit('status_change', connectionState);

        // Notificar y cargar conversaciones iniciales
        try {
            const rawChats = await whatsappClient.getChats();
            const formatted = await formatChats(rawChats);
            io.emit('chats_list', formatted);
        } catch (err) {
            console.error('Error al obtener conversaciones iniciales:', err);
        }
    });

    // Evento: Fallo de autenticación
    whatsappClient.on('auth_failure', async (msg) => {
        if (client !== whatsappClient || closingClient) return;
        closingClient = true;
        console.error('Fallo de autenticación:', msg);
        connectionState.status = 'disconnected';
        connectionState.qrCode = null;
        connectionState.info = null;
        io.emit('status_change', { ...connectionState, error: 'Fallo al autenticar' });
        try {
            await whatsappClient.destroy();
            await fs.promises.rm(authSessionPath, { recursive: true, force: true, maxRetries: 10 });
        } catch (err) {
            console.error('Error limpiando cliente tras fallo de autenticación:', err);
        } finally {
            if (client === whatsappClient) client = null;
            closingClient = false;
            releaseInstanceLock();
        }
    });

    // Evento: Desconectado
    whatsappClient.on('disconnected', async (reason) => {
        if (client !== whatsappClient || closingClient) return;
        closingClient = true;
        console.log('Cliente desconectado:', reason);
        try {
            await whatsappClient.destroy();
            if (reason === 'LOGOUT') {
                await fs.promises.rm(authSessionPath, { recursive: true, force: true, maxRetries: 10 });
            }
        } catch (err) {
            console.error('Error cerrando cliente desconectado:', err);
        } finally {
            if (client === whatsappClient) client = null;
            closingClient = false;
            releaseInstanceLock();
            connectionState.status = 'disconnected';
            connectionState.qrCode = null;
            connectionState.info = null;
            io.emit('status_change', connectionState);
        }
    });

    // Evento: Nuevo mensaje (recibido o enviado por el usuario)
    whatsappClient.on('message_create', async (msg) => {
        try {
            const formattedMsg = formatMessage(msg);
            io.emit('new_message', formattedMsg);

            scheduleChatListRefresh(whatsappClient);
        } catch (err) {
            console.error('Error procesando nuevo mensaje:', err);
        }
    });

    whatsappClient.initialize().catch(async err => {
        if (client !== whatsappClient) return;
        closingClient = true;
        console.error('Error al inicializar cliente:', err);
        connectionState.status = 'disconnected';
        connectionState.qrCode = null;
        io.emit('status_change', { ...connectionState, error: err.message });
        try {
            await whatsappClient.destroy();
        } catch (destroyError) {
            console.error('Error cerrando el cliente tras fallar la inicialización:', destroyError);
        } finally {
            if (client === whatsappClient) client = null;
            closingClient = false;
            releaseInstanceLock();
        }
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
            const messages = await chat.fetchMessages({ limit: 51 });
            socket.emit('messages_list', {
                chatId,
                messages: messages.slice(-50).map(formatMessage),
                hasMore: messages.length > 50
            });
        } catch (err) {
            console.error(`Error obteniendo mensajes para ${chatId}:`, err);
            socket.emit('messages_list', { chatId, messages: [] });
        }
    });

    socket.on('load_older_messages', async ({ chatId, offset } = {}) => {
        if (!client || connectionState.status !== 'connected') {
            return socket.emit('older_messages', { chatId, messages: [], hasMore: false });
        }
        if (typeof chatId !== 'string' || !Number.isSafeInteger(offset) || offset < 50) {
            return socket.emit('older_messages', { chatId, messages: [], hasMore: true, error: 'Solicitud de historial no válida' });
        }
        try {
            const chat = await client.getChatById(chatId);
            const messages = await chat.fetchMessages({ limit: offset + 51 });
            const olderMessages = messages.slice(0, Math.max(0, messages.length - offset)).slice(-50);
            socket.emit('older_messages', {
                chatId,
                messages: olderMessages.map(formatMessage),
                hasMore: messages.length > offset + 50
            });
        } catch (err) {
            console.error(`Error obteniendo mensajes anteriores para ${chatId}:`, err);
            socket.emit('older_messages', { chatId, messages: [], hasMore: true, error: 'No se pudieron cargar los mensajes anteriores' });
        }
    });

    socket.on('send_message', async (data, acknowledge) => {
        const whatsappClient = client;
        try {
            if (!whatsappClient || closingClient || connectionState.status !== 'connected') {
                throw new Error('WhatsApp no está conectado');
            }
            const { chatId, body = '', media } = data || {};
            if (typeof chatId !== 'string' || typeof body !== 'string' || (!body.trim() && !media)) {
                throw new Error('Escribe un mensaje o selecciona un archivo');
            }

            const chat = await whatsappClient.getChatById(chatId);
            if (client !== whatsappClient || closingClient) {
                throw new Error('WhatsApp se desconectó antes de completar el envío. Revisa la conversación antes de volver a intentarlo.');
            }
            if (media) {
                if (typeof media.data !== 'string' || media.data.length % 4 !== 0 || !/^[\w+/]*={0,2}$/.test(media.data) || typeof media.mimetype !== 'string' || !/^[\w.+-]+\/[\w.+-]+$/.test(media.mimetype) || typeof media.filename !== 'string' || Buffer.byteLength(media.data, 'base64') > MAX_MEDIA_SIZE) {
                    throw new Error('El archivo no es válido o supera el límite de 8 MB');
                }
                await chat.sendMessage(new MessageMedia(media.mimetype, media.data, media.filename), body.trim() ? { caption: body.trim() } : {});
            } else {
                await chat.sendMessage(body.trim());
            }
            acknowledge?.({ ok: true });
        } catch (err) {
            console.error('Error enviando mensaje:', err);
            if (err.message?.includes('detached Frame') && client === whatsappClient && !closingClient) {
                whatsappClient.emit('disconnected', 'BROWSER_FRAME_DETACHED');
                acknowledge?.({ ok: false, error: 'WhatsApp Web perdió la conexión durante el envío. Reconéctalo y revisa la conversación antes de volver a intentarlo.' });
                return;
            }
            acknowledge?.({ ok: false, error: err.message || 'No se pudo enviar el mensaje' });
        }
    });

    socket.on('get_media', async (data, acknowledge) => {
        try {
            if (!client || connectionState.status !== 'connected') throw new Error('WhatsApp no está conectado');
            const { chatId, messageId } = data || {};
            if (typeof chatId !== 'string' || typeof messageId !== 'string') throw new Error('Mensaje no válido');
            const message = await client.getMessageById(messageId);
            if (!message?.hasMedia || (message.fromMe ? message.to : message.from) !== chatId) throw new Error('No se encontró el archivo');
            const media = await message.downloadMedia();
            if (!media) throw new Error('No se pudo descargar el archivo');
            if (Buffer.byteLength(media.data, 'base64') > MAX_MEDIA_SIZE) throw new Error('El archivo supera el límite de 8 MB');
            acknowledge?.({ ok: true, media });
        } catch (err) {
            console.error('Error obteniendo archivo multimedia:', err);
            acknowledge?.({ ok: false, error: err.message || 'No se pudo cargar el archivo' });
        }
    });

    // Generar resumen con la capa de abstracción SummaryService
    socket.on('generate_summary', async (data, acknowledge) => {
        try {
            let messages = data?.messages;

            // Si el cliente no pasó mensajes directamente pero proporcionó chatId, intentar leerlos del chat
            if ((!Array.isArray(messages) || messages.length === 0) && data?.chatId && client && connectionState.status === 'connected') {
                const chat = await client.getChatById(data.chatId);
                const rawMessages = await chat.fetchMessages({ limit: 50 });
                const chatDisplayName = await resolveChatDisplayName(chat);
                messages = rawMessages.map(m => {
                    let senderName = 'Contacto';
                    if (m.fromMe) {
                        senderName = 'Tú';
                    } else if (m._data?.notifyName) {
                        senderName = m._data.notifyName;
                    } else if (m.author && !m.author.includes('@lid')) {
                        senderName = m.author.split('@')[0];
                    } else {
                        senderName = chatDisplayName;
                    }
                    return {
                        sender: senderName,
                        content: m.body || (m.hasMedia ? '[Multimedia]' : '')
                    };
                }).filter(m => m.content.trim().length > 0);
            }

            if (!Array.isArray(messages) || messages.length === 0) {
                return acknowledge?.({
                    ok: false,
                    error: 'No se encontraron mensajes en esta conversación para generar el resumen.'
                });
            }

            const summary = await summaryService.generateSummary(messages);
            acknowledge?.({
                ok: true,
                summary,
                provider: summaryService.getProviderName()
            });
        } catch (err) {
            console.error('Error generando resumen:', err);
            acknowledge?.({
                ok: false,
                error: err.message || 'Error al generar el resumen de la conversación'
            });
        }
    });

    // Desconectar sesión manualmente
    socket.on('disconnect_session', async () => {
        const whatsappClient = client;
        if (whatsappClient) {
            closingClient = true;
            client = null;
            try {
                await whatsappClient.logout();
            } catch (e) {
                console.warn('Error al hacer logout:', e.message);
            }
            try {
                await whatsappClient.destroy();
            } catch (e) {
                console.warn('Error al destruir cliente:', e.message);
            }
            try {
                await fs.promises.rm(authSessionPath, { recursive: true, force: true, maxRetries: 10 });
            } catch (e) {
                console.warn('Error al limpiar la sesión local:', e.message);
            } finally {
                closingClient = false;
                releaseInstanceLock();
            }
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

// Endpoint REST alternativo para generación de resúmenes
app.post('/api/summary', async (req, res) => {
    try {
        const { messages } = req.body;
        if (!Array.isArray(messages)) {
            return res.status(400).json({ ok: false, error: 'El cuerpo debe incluir un arreglo de mensajes: [{ sender, content }]' });
        }
        const summary = await summaryService.generateSummary(messages);
        res.json({ ok: true, summary, provider: summaryService.getProviderName() });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(` Servidor de WhatsApp Web iniciado en puerto ${PORT}`);
    console.log(` Abre http://localhost:${PORT} en tu navegador`);
    console.log(`===============================================`);
});
