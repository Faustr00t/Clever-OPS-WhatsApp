const { GoogleGenAI } = require('@google/genai');
const SummaryProvider = require('../SummaryProvider');

/**
 * Proveedor real para Google Gemini.
 * Utiliza el SDK oficial @google/genai con salida estructurada en JSON.
 */
class GeminiProvider extends SummaryProvider {
    /**
     * @param {string} apiKey - Clave de API de Google Gemini (Google AI Studio)
     * @param {string} [modelName='gemini-2.5-flash'] - Modelo de Gemini a utilizar
     */
    constructor(apiKey, modelName = 'gemini-2.5-flash') {
        super();
        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
            throw new Error("Se requiere una API Key válida de Google Gemini.");
        }

        this.apiKey = apiKey.trim();
        this.modelName = modelName;
        this.ai = new GoogleGenAI({ apiKey: this.apiKey, apiVersion: 'v1beta' });
    }

    /**
     * Genera un resumen estructurado utilizando Google Gemini.
     * @param {Array<{sender: string, content: string}>} messages
     */
    async generateSummary(messages) {
        if (!Array.isArray(messages) || messages.length === 0) {
            return {
                topic: "Sin mensajes suficientes",
                participants: [],
                pendingTasks: "No se identificaron tareas pendientes.",
                detectedDates: "No especificada",
                stoppers: [],
                rawSummary: "No hay mensajes suficientes en la conversación para generar un resumen."
            };
        }

        // Formatear el historial de chat para el prompt
        const formattedChat = messages
            .map(m => `[${m.sender}]: ${m.content}`)
            .join('\n');

        const prompt = `Eres un asistente experto en análisis y síntesis de conversaciones de WhatsApp.
Analiza la siguiente conversación y genera un resumen estructurado y profesional en español.

Extrae:
1. "topic": El tema principal o propósito central de la conversación (máximo 1 o 2 oraciones).
2. "participants": Lista con los nombres de las personas que participaron activamente.
3. "pendingTasks": Las tareas, compromisos o acciones pendientes que quedaron acordadas.
4. "detectedDates": Plazos, días o fechas específicas mencionadas (si no hay, indica "No especificada").
5. "stoppers": Lista de problemas concretos mencionados en la conversación que bloquean o impiden avanzar. No incluyas recomendaciones ni riesgos hipotéticos. Ordena primero los que bloquean más trabajo. Si no hay ninguno, devuelve una lista vacía.

Conversación a analizar:
${formattedChat}`;

        try {
            const response = await this.ai.models.generateContent({
                model: this.modelName,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: 'object',
                        properties: {
                            topic: { type: 'string', description: 'Tema principal de la conversación' },
                            participants: { 
                                type: 'array', 
                                items: { type: 'string' },
                                description: 'Participantes de la conversación'
                            },
                            pendingTasks: { type: 'string', description: 'Acciones o tareas pendientes' },
                            detectedDates: { type: 'string', description: 'Fechas o plazos detectados' },
                            stoppers: { type: 'array', items: { type: 'string' }, description: 'Problemas concretos que bloquean el avance, ordenados por impacto' }
                        },
                        required: ['topic', 'participants', 'pendingTasks', 'detectedDates', 'stoppers']
                    }
                }
            });

            const responseText = response.text || '';
            const parsed = JSON.parse(responseText);

            const topic = parsed.topic || 'Conversación general';
            const participants = Array.isArray(parsed.participants) ? parsed.participants : [];
            const pendingTasks = parsed.pendingTasks || 'Ninguno especificado';
            const detectedDates = parsed.detectedDates || 'No especificada';
            const stoppers = Array.isArray(parsed.stoppers) ? parsed.stoppers.filter(item => typeof item === 'string' && item.trim()) : [];

            const rawSummary = [
                `Tema principal: ${topic}`,
                `Participantes: ${participants.join(', ')}`,
                `Pendientes: ${pendingTasks}`,
                `Fecha detectada: ${detectedDates}`,
                `\nStoppers:\n${stoppers.length ? stoppers.map((item, index) => `${index + 1}. ${item}`).join('\n') : 'Hurra, no hay Stoppers. Por ahora'}`
            ].join('\n');

            return {
                topic,
                participants,
                pendingTasks,
                detectedDates,
                stoppers,
                rawSummary
            };
        } catch (error) {
            console.error("Error al generar resumen con Google Gemini:", error);
            throw new Error(`Error de Gemini API: ${error.message || 'No se pudo conectar con el servicio'}`);
        }
    }
}

module.exports = GeminiProvider;
