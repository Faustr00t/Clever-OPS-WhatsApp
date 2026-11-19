const MockSummaryProvider = require('./MockSummaryProvider');

/**
 * Capa de abstracción para la generación de resúmenes de conversaciones.
 * 
 * Permite cambiar de proveedor (Mock, Gemini, OpenAI, Claude, etc.)
 * sin alterar la lógica de la aplicación ni la interfaz de usuario.
 */
class SummaryService {
    /**
     * @param {import('./SummaryProvider')} [provider] - Proveedor inicial (por defecto MockSummaryProvider)
     */
    constructor(provider = new MockSummaryProvider()) {
        this.setProvider(provider);
    }

    /**
     * Permite intercambiar el proveedor de resúmenes dinámicamente en tiempo de ejecución.
     * @param {import('./SummaryProvider')} provider
     */
    setProvider(provider) {
        if (!provider || typeof provider.generateSummary !== 'function') {
            throw new Error("El proveedor debe implementar el método generateSummary(messages)");
        }
        this.provider = provider;
    }

    /**
     * Retorna el nombre del proveedor actualmente activo
     * @returns {string}
     */
    getProviderName() {
        return this.provider.constructor.name;
    }

    /**
     * Genera un resumen a partir de un arreglo de mensajes.
     * 
     * @param {Array<{sender: string, content: string}>} messages - Lista de mensajes
     * @returns {Promise<{topic: string, participants: string[], pendingTasks: string, detectedDates: string, rawSummary: string}>}
     */
    async generateSummary(messages) {
        if (!Array.isArray(messages)) {
            throw new Error("El método generateSummary requiere un arreglo de mensajes");
        }

        // Sanitizar y validar estructura de los mensajes
        const normalizedMessages = messages
            .filter(m => m && typeof m === 'object')
            .map(m => ({
                sender: String(m.sender || 'Desconocido').trim(),
                content: String(m.content || '').trim()
            }))
            .filter(m => m.content.length > 0);

        return await this.provider.generateSummary(normalizedMessages);
    }
}

module.exports = SummaryService;
