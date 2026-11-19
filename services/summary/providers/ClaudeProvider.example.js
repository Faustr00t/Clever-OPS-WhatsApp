const SummaryProvider = require('../SummaryProvider');

/**
 * EJEMPLO DE INTEGRACIÓN FUTURA: Anthropic Claude (Claude 3.5 Haiku / Sonnet)
 * 
 * Para activar este proveedor en el futuro:
 * 1. Instalar la librería: npm install @anthropic-ai/sdk
 * 2. Renombrar este archivo a ClaudeProvider.js
 * 3. En server.js:
 *    const ClaudeProvider = require('./services/summary/providers/ClaudeProvider');
 *    summaryService.setProvider(new ClaudeProvider(process.env.ANTHROPIC_API_KEY));
 */
class ClaudeProvider extends SummaryProvider {
    constructor(apiKey, modelName = 'claude-3-5-haiku-latest') {
        super();
        this.apiKey = apiKey;
        this.modelName = modelName;
    }

    async generateSummary(messages) {
        // AQUÍ IRÁ LA LLAMADA A LA API DE CLAUDE CUANDO SE IMPLEMENTE
        throw new Error("ClaudeProvider aún no tiene configurada una clave de API activa.");
    }
}

module.exports = ClaudeProvider;
