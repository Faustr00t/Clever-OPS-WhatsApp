const SummaryService = require('./SummaryService');
const SummaryProvider = require('./SummaryProvider');
const MockSummaryProvider = require('./MockSummaryProvider');
const GeminiProvider = require('./providers/GeminiProvider');

let initialProvider;

const geminiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';

if (geminiKey) {
    try {
        initialProvider = new GeminiProvider(geminiKey);
        console.log('🤖 [SummaryService] Proveedor activo: Google Gemini (GeminiProvider)');
    } catch (err) {
        console.warn('⚠️ [SummaryService] Error al inicializar GeminiProvider, usando Mock:', err.message);
        initialProvider = new MockSummaryProvider();
    }
} else {
    console.log('ℹ️ [SummaryService] No se detectó GEMINI_API_KEY en .env. Proveedor activo: Simulado (MockSummaryProvider)');
    initialProvider = new MockSummaryProvider();
}

// Instancia única (Singleton) lista para usarse
const summaryService = new SummaryService(initialProvider);

module.exports = {
    SummaryService,
    SummaryProvider,
    MockSummaryProvider,
    GeminiProvider,
    summaryService
};
