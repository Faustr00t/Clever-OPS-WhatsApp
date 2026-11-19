const SummaryProvider = require('../SummaryProvider');

/**
 * EJEMPLO DE INTEGRACIÓN FUTURA: Google Gemini
 * 
 * Para activar este proveedor en el futuro:
 * 1. Instalar la librería: npm install @google/genai (o @google/generative-ai)
 * 2. Renombrar este archivo a GeminiProvider.js
 * 3. En server.js:
 *    const GeminiProvider = require('./services/summary/providers/GeminiProvider');
 *    summaryService.setProvider(new GeminiProvider(process.env.GEMINI_API_KEY));
 */
class GeminiProvider extends SummaryProvider {
    constructor(apiKey, modelName = 'gemini-1.5-flash') {
        super();
        this.apiKey = apiKey;
        this.modelName = modelName;
    }

    async generateSummary(messages) {
        // Formatear la conversación para el prompt
        const conversationText = messages
            .map(m => `${m.sender}: ${m.content}`)
            .join('\n');

        const prompt = `Analiza la siguiente conversación de WhatsApp y genera un resumen estructurado en español con el formato:
Tema principal: [tema breve]
Participantes: [nombres de participantes]
Pendientes: [tareas o compromisos pendientes]
Fecha detectada: [fechas o plazos mencionados, o "No especificada"]

Conversación:
${conversationText}`;

        // AQUÍ IRÁ LA LLAMADA A LA API DE GEMINI CUANDO SE IMPLEMENTE:
        // const response = await ai.models.generateContent({ model: this.modelName, contents: prompt });
        // return parseSummaryResponse(response.text);

        throw new Error("GeminiProvider aún no tiene configurada una clave de API activa.");
    }
}

module.exports = GeminiProvider;
