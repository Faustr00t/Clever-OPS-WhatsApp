const SummaryProvider = require('../SummaryProvider');

/**
 * EJEMPLO DE INTEGRACIÓN FUTURA: OpenAI (GPT-4o / GPT-4o-mini)
 * 
 * Para activar este proveedor en el futuro:
 * 1. Instalar la librería: npm install openai
 * 2. Renombrar este archivo a OpenAIProvider.js
 * 3. En server.js:
 *    const OpenAIProvider = require('./services/summary/providers/OpenAIProvider');
 *    summaryService.setProvider(new OpenAIProvider(process.env.OPENAI_API_KEY));
 */
class OpenAIProvider extends SummaryProvider {
    constructor(apiKey, modelName = 'gpt-4o-mini') {
        super();
        this.apiKey = apiKey;
        this.modelName = modelName;
    }

    async generateSummary(messages) {
        // AQUÍ IRÁ LA LLAMADA A LA API DE OPENAI CUANDO SE IMPLEMENTE
        throw new Error("OpenAIProvider aún no tiene configurada una clave de API activa.");
    }
}

module.exports = OpenAIProvider;
