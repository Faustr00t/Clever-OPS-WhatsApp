// Cliente Socket.io y lógica de interfaz
const socket = io();

// Estado en memoria de la UI
let currentStatus = 'disconnected';
let chats = [];
let activeChatId = null;
let currentChatMessages = [];
let messagesLoadingChatId = null;
let hasOlderMessages = false;
let olderMessagesLoading = false;
let summaryInFlight = false;

// Elementos del DOM
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const btnConnect = document.getElementById('btn-connect');
const btnDisconnect = document.getElementById('btn-disconnect');
const userDisplayName = document.getElementById('user-display-name');

const searchInput = document.getElementById('search-input');
const chatListContainer = document.getElementById('chat-list');

const placeholderView = document.getElementById('placeholder-view');
const conversationView = document.getElementById('conversation-view');
const chatHeaderName = document.getElementById('chat-header-name');
const chatHeaderAvatar = document.getElementById('chat-header-avatar');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const sendError = document.getElementById('send-error');
const mediaInput = document.getElementById('media-input');
const btnAttach = document.getElementById('btn-attach');
const attachmentName = document.getElementById('attachment-name');

const qrModal = document.getElementById('qr-modal');
const qrImage = document.getElementById('qr-image');
const qrSpinner = document.getElementById('qr-spinner');
const qrStatusMsg = document.getElementById('qr-status-msg');
const btnCloseQr = document.getElementById('btn-close-qr');

// Elementos del Modal de Resumen con IA
const btnGenerateSummary = document.getElementById('btn-generate-summary');
const summaryModal = document.getElementById('summary-modal');
const btnCloseSummary = document.getElementById('btn-close-summary');
const summaryLoading = document.getElementById('summary-loading');
const summaryContent = document.getElementById('summary-content');
const summaryError = document.getElementById('summary-error');
const summaryProviderName = document.getElementById('summary-provider-name');
const summaryProviderTag = document.getElementById('summary-provider-tag');
const summaryTopic = document.getElementById('summary-topic');
const summaryParticipants = document.getElementById('summary-participants');
const summaryPending = document.getElementById('summary-pending');
const summaryDate = document.getElementById('summary-date');
const summaryRawText = document.getElementById('summary-raw-text');
const btnCopySummary = document.getElementById('btn-copy-summary');

/**
 * Formatea una marca de tiempo en formato legible para chats (HH:mm o fecha)
 */
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    
    // Si es hoy, mostrar hora:minutos
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Si fue en los últimos 6 días, mostrar día de la semana
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
    }
    
    // Si es más antiguo, mostrar fecha DD/MM/AA
    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/**
 * Obtiene iniciales para el avatar
 */
function getInitials(name) {
    if (!name || name.includes('@lid')) return '👤';
    const cleanName = name.replace(/[^a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑ+]/g, '').trim();
    if (!cleanName) return '👤';
    const words = cleanName.split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Actualiza los indicadores visuales de estado de conexión
 */
function updateConnectionUI(state) {
    currentStatus = state.status;

    // Quitar clases anteriores
    statusDot.className = 'status-dot';
    statusText.title = '';

    switch (state.status) {
        case 'connected':
            statusDot.classList.add('status-connected');
            statusText.textContent = 'Conectado';
            btnConnect.classList.add('hidden');
            btnDisconnect.classList.remove('hidden');
            hideQRModal();
            if (state.info && state.info.pushname) {
                userDisplayName.textContent = state.info.pushname;
            } else {
                userDisplayName.textContent = 'WhatsApp Web';
            }
            break;

        case 'connecting':
            statusDot.classList.add('status-connecting');
            statusText.textContent = state.message || 'Conectando...';
            btnConnect.classList.add('hidden');
            btnDisconnect.classList.remove('hidden');

            // Si hay un código QR disponible, mostrarlo en el modal
            if (state.qrCode) {
                showQRModal(state.qrCode);
            } else {
                showQRModal(null, state.message || 'Iniciando sesión segura...');
            }
            break;

        case 'disconnected':
        default:
            statusDot.classList.add('status-disconnected');
            statusText.textContent = state.error || state.message || 'Desconectado';
            statusText.title = state.error || state.message || '';
            btnConnect.classList.remove('hidden');
            btnDisconnect.classList.add('hidden');
            userDisplayName.textContent = 'WhatsApp';
            hideQRModal();
            break;
    }
}

/**
 * Muestra el modal con el código QR o spinner de carga
 */
function showQRModal(qrCodeUrl, customMsg) {
    qrModal.classList.remove('hidden');
    const qrProgressFill = document.getElementById('qr-progress-fill');
    if (qrCodeUrl) {
        qrImage.onload = () => {
            qrImage.classList.remove('hidden');
            qrSpinner.classList.add('hidden');
        };
        qrImage.onerror = () => {
            qrImage.classList.add('hidden');
            qrSpinner.classList.remove('hidden');
            qrStatusMsg.textContent = 'No se pudo cargar el código QR. Intenta conectar de nuevo.';
        };
        if (qrImage.getAttribute('src') !== qrCodeUrl || !qrImage.complete || !qrImage.naturalWidth) {
            qrImage.src = qrCodeUrl;
        } else {
            qrImage.onload();
        }
    } else {
        qrImage.classList.add('hidden');
        qrSpinner.classList.remove('hidden');
        if (qrProgressFill) qrProgressFill.style.width = '15%';
        if (customMsg) {
            qrStatusMsg.textContent = customMsg;
        }
    }
}

/**
 * Oculta el modal de código QR
 */
function hideQRModal() {
    qrModal.classList.add('hidden');
    qrImage.classList.add('hidden');
    qrSpinner.classList.remove('hidden');
}

/**
 * Renderiza la lista de conversaciones en el panel lateral
 */
function renderChats() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const filteredChats = chats.filter(chat => {
        const nameMatch = (chat.name || '').toLowerCase().includes(searchTerm);
        const lastMsgMatch = (chat.lastMessage || '').toLowerCase().includes(searchTerm);
        return nameMatch || lastMsgMatch;
    });

    if (filteredChats.length === 0) {
        if (currentStatus !== 'connected') {
            chatListContainer.innerHTML = `
                <div class="empty-state-list">
                    <p>No hay conexión activa.</p>
                    <p class="sub-tip">Haz clic en <strong>Conectar</strong> para vincular tu WhatsApp.</p>
                </div>
            `;
        } else {
            chatListContainer.innerHTML = `
                <div class="empty-state-list">
                    <p>No se encontraron conversaciones.</p>
                </div>
            `;
        }
        return;
    }

    const fragment = document.createDocumentFragment();
    filteredChats.forEach(chat => {
        const item = document.createElement('div');
        item.className = `chat-item ${chat.id === activeChatId ? 'active' : ''}`;
        item.dataset.chatId = chat.id;

        const initials = getInitials(chat.name);
        const timeDisplay = formatTime(chat.timestamp);

        item.innerHTML = `
            <div class="chat-avatar">${initials}</div>
            <div class="chat-details">
                <div class="chat-top-row">
                    <span class="chat-name">${escapeHTML(chat.name)}</span>
                    <span class="chat-time">${timeDisplay}</span>
                </div>
                <div class="chat-bottom-row">
                    <span class="chat-last-message">${escapeHTML(chat.lastMessage || '')}</span>
                    ${chat.unreadCount > 0 ? `<span class="unread-badge">${chat.unreadCount}</span>` : ''}
                </div>
            </div>
        `;

        fragment.appendChild(item);
    });
    chatListContainer.replaceChildren(fragment);
}

/**
 * Selecciona una conversación y carga sus mensajes
 */
function selectChat(chat) {
    if (messagesLoadingChatId === chat.id) return;
    messagesLoadingChatId = chat.id;
    hasOlderMessages = false;
    olderMessagesLoading = false;
    activeChatId = chat.id;
    currentChatMessages = [];
    sendError.textContent = '';

    // Actualizar clase activa en la lista
    document.querySelectorAll('.chat-item').forEach(el => {
        el.classList.toggle('active', el.dataset.chatId === chat.id);
    });

    // Actualizar cabecera de la conversación
    chatHeaderName.textContent = chat.name;
    chatHeaderAvatar.textContent = getInitials(chat.name);

    // Cambiar vista de placeholder a conversación activa
    placeholderView.classList.add('hidden');
    conversationView.classList.remove('hidden');

    // Mostrar loader de mensajes y pedir datos al servidor
    messagesContainer.innerHTML = '<div class="messages-loading">Cargando mensajes de la conversación...</div>';
    socket.emit('get_messages', chat.id);
}

/**
 * Renderiza los mensajes dentro de la conversación activa
 */
function renderMessages(messages) {
    messagesContainer.innerHTML = '';

    if (!messages || messages.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'messages-loading';
        empty.textContent = 'No hay mensajes recientes en esta conversación.';
        messagesContainer.appendChild(empty);
        return;
    }

    updateOlderMessagesButton();
    messages.forEach(msg => {
        appendMessageBubble(msg, false);
    });

    // Desplazar al último mensaje (abajo)
    scrollToBottom();
}

function updateOlderMessagesButton() {
    let button = messagesContainer.querySelector('.load-older-messages');
    if (!hasOlderMessages) {
        button?.remove();
        return;
    }
    if (!button) {
        button = document.createElement('button');
        button.className = 'load-older-messages';
        button.addEventListener('click', () => {
            if (olderMessagesLoading || !activeChatId) return;
            olderMessagesLoading = true;
            button.disabled = true;
            button.textContent = 'Cargando mensajes anteriores...';
            socket.emit('load_older_messages', { chatId: activeChatId, offset: currentChatMessages.length });
        });
        messagesContainer.prepend(button);
    }
    button.disabled = olderMessagesLoading;
    button.textContent = olderMessagesLoading ? 'Cargando mensajes anteriores...' : 'Cargar mensajes anteriores';
}

/**
 * Añade una burbuja de mensaje individual al contenedor
 */
function appendMessageBubble(msg, shouldScroll = true, prepend = false) {
    const isOut = msg.fromMe;
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${isOut ? 'message-out' : 'message-in'}`;
    bubble.dataset.msgId = msg.id;

    const formattedTime = msg.timestamp 
        ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        : '';

    bubble.innerHTML = `
        <div class="message-body">${escapeHTML(msg.body || '')}</div>
        <div class="message-meta">
            <span class="message-time">${formattedTime}</span>
            ${isOut ? '<span class="message-ticks">✓✓</span>' : ''}
        </div>
    `;

    if (prepend) {
        const firstMessage = messagesContainer.querySelector('.message-bubble');
        messagesContainer.insertBefore(bubble, firstMessage || null);
    } else {
        messagesContainer.appendChild(bubble);
    }

    if (msg.hasMedia) {
        const loadMedia = document.createElement('button');
        loadMedia.className = 'media-load-button';
        loadMedia.textContent = `Cargar ${msg.mediaFilename || 'archivo multimedia'}`;
        loadMedia.dataset.chatId = msg.chatId;
        loadMedia.dataset.messageId = msg.id;
        const body = bubble.querySelector('.message-body');
        body.appendChild(document.createElement('br'));
        body.appendChild(loadMedia);
    }

    if (shouldScroll) {
        scrollToBottom();
    }
}

/**
 * Desplaza suavemente el panel de mensajes hacia el final
 */
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Escapar texto para prevenir inyecciones HTML en el navegador
 */
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* =====================================
   MANEJO DE EVENTOS DE SOCKET.IO
   ===================================== */

// Cambio de estado de la conexión
socket.on('status_change', (state) => {
    console.log('Cambio de estado:', state);
    updateConnectionUI(state);
});

// Progreso de carga interna de WhatsApp Web
socket.on('loading_progress', (data) => {
    const qrProgressFill = document.getElementById('qr-progress-fill');
    if (qrProgressFill && typeof data.percent === 'number') {
        qrProgressFill.style.width = `${Math.min(Math.max(data.percent, 15), 100)}%`;
    }
    if (qrStatusMsg && typeof data.percent === 'number') {
        qrStatusMsg.textContent = `Cargando WhatsApp Web: ${data.percent}%`;
    }
});

// Lista de chats recibida o actualizada
socket.on('chats_list', (newChats) => {
    chats = newChats;
    renderChats();
});

// Lista de mensajes de la conversación activa
socket.on('messages_list', (data) => {
    if (data.chatId === messagesLoadingChatId) messagesLoadingChatId = null;
    if (data.chatId === activeChatId) {
        currentChatMessages = data.messages || [];
        hasOlderMessages = Boolean(data.hasMore);
        renderMessages(data.messages);
    }
});

socket.on('older_messages', (data) => {
    if (data.chatId !== activeChatId) return;
    olderMessagesLoading = false;
    if (data.error) {
        updateOlderMessagesButton();
        const button = messagesContainer.querySelector('.load-older-messages');
        if (button) button.textContent = 'Reintentar mensajes anteriores';
        return;
    }

    const oldHeight = messagesContainer.scrollHeight;
    const oldScrollTop = messagesContainer.scrollTop;
    const knownIds = new Set(currentChatMessages.map(message => message.id));
    const olderMessages = (data.messages || []).filter(message => !knownIds.has(message.id));
    currentChatMessages = [...olderMessages, ...currentChatMessages];
    hasOlderMessages = Boolean(data.hasMore);
    olderMessages.slice().reverse().forEach(message => appendMessageBubble(message, false, true));
    updateOlderMessagesButton();
    messagesContainer.scrollTop = oldScrollTop + messagesContainer.scrollHeight - oldHeight;
});

// Nuevo mensaje entrante o saliente en tiempo real
socket.on('new_message', (msg) => {
    console.log('Nuevo mensaje recibido:', msg);

    // Si el mensaje pertenece a la conversación abierta actualmente
    if (activeChatId && (msg.chatId === activeChatId || msg.from === activeChatId || msg.to === activeChatId)) {
        if (!currentChatMessages.some(message => message.id === msg.id)) {
            currentChatMessages.push(msg);
            appendMessageBubble(msg, true);
        }
    }
});

messagesContainer.addEventListener('click', (event) => {
    const button = event.target.closest('.media-load-button');
    if (!button) return;

    button.disabled = true;
    button.textContent = 'Cargando archivo...';
    socket.emit('get_media', { chatId: button.dataset.chatId, messageId: button.dataset.messageId }, (result) => {
        if (!result?.ok) {
            button.disabled = false;
            button.textContent = result?.error || 'No se pudo cargar el archivo';
            return;
        }

        const { mimetype, data, filename } = result.media;
        const url = `data:${mimetype};base64,${data}`;
        let mediaElement;
        if (mimetype.startsWith('image/') && mimetype !== 'image/svg+xml') {
            mediaElement = document.createElement('img');
            mediaElement.alt = filename || 'Imagen recibida';
        } else if (mimetype.startsWith('video/')) {
            mediaElement = document.createElement('video');
            mediaElement.controls = true;
        } else if (mimetype.startsWith('audio/')) {
            mediaElement = document.createElement('audio');
            mediaElement.controls = true;
        } else {
            mediaElement = document.createElement('a');
            mediaElement.download = filename || 'archivo';
            mediaElement.textContent = `Descargar ${filename || 'archivo'}`;
        }
        mediaElement.classList.add('media-preview');
        if (mediaElement.tagName === 'A') mediaElement.href = url;
        else mediaElement.src = url;
        button.replaceWith(mediaElement);
    });
});

mediaInput.addEventListener('change', () => {
    attachmentName.textContent = mediaInput.files[0]?.name || '';
    sendError.textContent = '';
});

btnAttach.addEventListener('click', () => mediaInput.click());

messageForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const body = messageInput.value.trim();
    const file = mediaInput.files[0];
    const chatId = activeChatId;
    if ((!body && !file) || !chatId) return;

    sendError.textContent = '';
    const send = (media) => socket.emit('send_message', { chatId, body, media }, (result) => {
        if (result?.ok) {
            if (activeChatId === chatId && messageInput.value.trim() === body && mediaInput.files[0] === file) {
                messageInput.value = '';
                mediaInput.value = '';
                attachmentName.textContent = '';
            }
        } else if (activeChatId === chatId) sendError.textContent = result?.error || 'No se pudo enviar el mensaje';
    });

    if (!file) return send();
    if (file.size > 8 * 1024 * 1024) {
        if (activeChatId === chatId) sendError.textContent = 'El archivo supera el límite de 8 MB';
        return;
    }
    const reader = new FileReader();
    reader.onload = () => send({
        mimetype: file.type || 'application/octet-stream',
        filename: file.name,
        data: reader.result.split(',')[1]
    });
    reader.onerror = () => { if (activeChatId === chatId) sendError.textContent = 'No se pudo leer el archivo'; };
    reader.readAsDataURL(file);
});

/* =====================================
   INTERACCIONES DE USUARIO
   ===================================== */

// Botón de Conectar
btnConnect.addEventListener('click', () => {
    showQRModal(null, 'Iniciando navegador y generando código QR...');
    socket.emit('start_connection');
});

// Botón de Desconectar / Salir
btnDisconnect.addEventListener('click', () => {
    if (confirm('¿Deseas cerrar la sesión de WhatsApp actual?')) {
        socket.emit('disconnect_session');
        chats = [];
        activeChatId = null;
        renderChats();
        conversationView.classList.add('hidden');
        placeholderView.classList.remove('hidden');
    }
});

// Botón para cerrar modal de QR manualmente
btnCloseQr.addEventListener('click', () => {
    hideQRModal();
});

// Filtrado en vivo de chats
searchInput.addEventListener('input', () => {
    renderChats();
});

chatListContainer.addEventListener('click', (event) => {
    const item = event.target.closest('.chat-item');
    if (!item) return;
    const chat = chats.find(candidate => candidate.id === item.dataset.chatId);
    if (chat) selectChat(chat);
});

/* =====================================
   INTERACCIONES: RESUMEN CON IA
   ===================================== */

// Botón para generar resumen de la conversación activa
if (btnGenerateSummary) {
    btnGenerateSummary.addEventListener('click', () => {
        if (!activeChatId || summaryInFlight) return;
        summaryInFlight = true;
        btnGenerateSummary.disabled = true;
        summaryLoading.querySelector('p').textContent = 'Generando resumen...';

        // Mostrar modal en estado de carga
        summaryModal.classList.remove('hidden');
        summaryLoading.classList.remove('hidden');
        summaryContent.classList.add('hidden');
        summaryError.classList.add('hidden');

        // Normalizar los mensajes en el formato requerido: [{ sender, content }]
        const messagesForSummary = currentChatMessages.map(msg => {
            let sender = 'Participante';
            if (msg.fromMe) {
                sender = 'Tú';
            } else if (msg.author && !msg.author.includes('@lid')) {
                sender = msg.author;
            } else if (chatHeaderName.textContent && !chatHeaderName.textContent.includes('@lid')) {
                sender = chatHeaderName.textContent;
            }
            return {
                sender,
                content: msg.body || ''
            };
        }).filter(m => m.content.trim().length > 0);

        // Solicitar resumen al servicio a través de Socket.io
        socket.emit('generate_summary', { 
            chatId: activeChatId, 
            messages: messagesForSummary 
        }, (res) => {
            summaryInFlight = false;
            btnGenerateSummary.disabled = false;
            summaryLoading.classList.add('hidden');

            if (res && res.ok && res.summary) {
                summaryContent.classList.remove('hidden');
                summaryProviderName.textContent = res.provider || 'MockSummaryProvider';
                if (summaryProviderTag) {
                    if (res.provider === 'GeminiProvider') {
                        summaryProviderTag.textContent = 'Google Gemini (Real)';
                        summaryProviderTag.className = 'badge-tag badge-tag-gemini';
                    } else {
                        summaryProviderTag.textContent = 'Simulado';
                        summaryProviderTag.className = 'badge-tag';
                    }
                }
                summaryTopic.textContent = res.summary.topic || '-';
                
                const participantsList = Array.isArray(res.summary.participants)
                    ? res.summary.participants.join(', ')
                    : (res.summary.participants || '-');
                summaryParticipants.textContent = participantsList;

                summaryPending.textContent = res.summary.pendingTasks || '-';
                summaryDate.textContent = res.summary.detectedDates || '-';
                summaryRawText.replaceChildren();
                const stoppers = Array.isArray(res.summary.stoppers) ? res.summary.stoppers : [];
                summaryRawText.parentElement.classList.toggle('summary-clear', stoppers.length === 0);
                (stoppers.length ? stoppers : ['Hurra, no hay Stoppers. Por ahora']).forEach(stopper => {
                    const item = document.createElement('li');
                    item.textContent = stopper;
                    summaryRawText.appendChild(item);
                });
            } else {
                summaryError.classList.remove('hidden');
                summaryError.textContent = res?.error || 'No se pudo generar el resumen en este momento.';
            }
        });
    });
}

// Botón para cerrar modal de resumen
if (btnCloseSummary) {
    btnCloseSummary.addEventListener('click', () => {
        summaryModal.classList.add('hidden');
    });
}

// Botón para copiar el resumen generado al portapapeles
if (btnCopySummary) {
    btnCopySummary.addEventListener('click', async () => {
        const fullSummaryToCopy = [
            `📌 Tema principal: ${summaryTopic.textContent}`,
            `👥 Participantes: ${summaryParticipants.textContent}`,
            `📋 Pendientes: ${summaryPending.textContent}`,
            `📅 Fecha detectada: ${summaryDate.textContent}`,
            `\n⛔ Stoppers:\n${Array.from(summaryRawText.children, (item, index) => `${index + 1}. ${item.textContent}`).join('\n')}`
        ].join('\n');

        if (!fullSummaryToCopy.trim()) return;

        try {
            await navigator.clipboard.writeText(fullSummaryToCopy);
            const originalText = btnCopySummary.textContent;
            btnCopySummary.textContent = '✅ ¡Copiado!';
            setTimeout(() => {
                btnCopySummary.textContent = originalText;
            }, 2000);
        } catch (err) {
            console.error('Error al copiar:', err);
        }
    });
}
