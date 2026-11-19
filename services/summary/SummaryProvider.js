/**
 * Interfaz base para cualquier proveedor de generación de resúmenes.
 * Todos los proveedores concretos (MockSummaryProvider, GeminiProvider, 
 * OpenAIProvider, ClaudeProvider) deben heredar de esta clase.
 */
class SummaryProvider {
    /**
     * Genera un resumen a partir de un arreglo de mensajes.
     * @param {Array<{sender: string, content: string}>} messages - Lista de mensajes normalizados
     * @returns {Promise<{topic: string, participants: string[], pendingTasks: string, detectedDates: string, rawSummary: string}>}
     */
    async generateSummary(messages) {
        throw new Error("El método generateSummary(messages) debe ser implementado por el proveedor.");
    }
}

module.exports = SummaryProvider;
