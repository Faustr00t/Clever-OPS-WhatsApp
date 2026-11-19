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
                solutions: "• No hay mensajes para sugerir soluciones.",
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
5. "solutions": Entre 2 y 4 posibles soluciones, sugerencias prácticas o pasos a seguir recomendados por la IA basados en la conversación. Cada solución debe empezar con viñeta "• ".

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
                            solutions: { type: 'string', description: 'Posibles soluciones o recomendaciones con viñetas' }
                        },
                        required: ['topic', 'participants', 'pendingTasks', 'detectedDates', 'solutions']
                    }
                }
            });

            const responseText = response.text || '';
            const parsed = JSON.parse(responseText);

            const topic = parsed.topic || 'Conversación general';
            const participants = Array.isArray(parsed.participants) ? parsed.participants : [];
            const pendingTasks = parsed.pendingTasks || 'Ninguno especificado';
            const detectedDates = parsed.detectedDates || 'No especificada';
            const solutions = parsed.solutions || '• Dar seguimiento a los puntos tratados.';

            const rawSummary = [
                `Tema principal: ${topic}`,
                `Participantes: ${participants.join(', ')}`,
                `Pendientes: ${pendingTasks}`,
                `Fecha detectada: ${detectedDates}`,
                `\nPosibles soluciones:\n${solutions}`
            ].join('\n');

            return {
                topic,
                participants,
                pendingTasks,
                detectedDates,
                solutions,
                rawSummary
            };
        } catch (error) {
            console.error("Error al generar resumen con Google Gemini:", error);
            throw new Error(`Error de Gemini API: ${error.message || 'No se pudo conectar con el servicio'}`);
        }
    }
}

module.exports = GeminiProvider;
