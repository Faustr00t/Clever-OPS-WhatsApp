const SummaryProvider = require('./SummaryProvider');

/**
 * Proveedor simulado para pruebas y desarrollo.
 * No realiza llamadas a APIs externas y retorna un resumen estructurado.
 */
class MockSummaryProvider extends SummaryProvider {
    /**
     * @param {Array<{sender: string, content: string}>} messages
     */
    async generateSummary(messages) {
        // Simular una ligera latencia de red/procesamiento como si fuera una IA real
        await new Promise(resolve => setTimeout(resolve, 600));

        if (!Array.isArray(messages) || messages.length === 0) {
            return {
                topic: "Sin mensajes suficientes",
                participants: [],
                pendingTasks: "No se identificaron tareas pendientes.",
                detectedDates: "No especificada",
                rawSummary: "Tema principal: Sin mensajes suficientes.\nParticipantes: Ninguno.\nPendientes: Ninguno.\nFecha detectada: No especificada."
            };
        }

        // Extraer participantes únicos
        const rawSenders = messages.map(m => m.sender).filter(Boolean);
        const uniqueSenders = [...new Set(rawSenders)];
        const participantsStr = uniqueSenders.length > 0 ? uniqueSenders.join(', ') : 'Participantes no identificados';

        // Detección contextual simulada basada en palabras clave
        const allContent = messages.map(m => m.content || '').join(' ').toLowerCase();

        let topic = 'Solicitud de reporte';
        let pending = 'Entrega de reporte';
        let date = 'mañana';

        if (allContent.includes('reunión') || allContent.includes('junta') || allContent.includes('llamada')) {
            topic = 'Coordinación de reunión';
            pending = 'Confirmar asistencia a la llamada/reunión';
            date = allContent.includes('hoy') ? 'hoy' : (allContent.includes('lunes') ? 'lunes' : 'próxima semana');
        } else if (allContent.includes('pago') || allContent.includes('factura') || allContent.includes('transferencia')) {
            topic = 'Gestión de pagos y facturas';
            pending = 'Enviar comprobante de transferencia';
            date = 'fin de mes';
        } else if (!allContent.includes('reporte')) {
            // Caso general cuando no coincide con las palabras clave anteriores
            topic = 'Conversación general del equipo';
            pending = 'Dar seguimiento a los acuerdos conversados';
            date = 'No especificada';
        }

        const stoppers = [];

        const rawSummary = [
            `Tema principal: ${topic}.`,
            `Participantes: ${participantsStr}.`,
            `Pendientes: ${pending}.`,
            `Fecha detectada: ${date}.`,
            `\nStoppers:\nHurra, no hay Stoppers. Por ahora`
        ].join('\n');

        return {
            topic,
            participants: uniqueSenders,
            pendingTasks: pending,
            detectedDates: date,
            stoppers,
            rawSummary
        };
    }
}

module.exports = MockSummaryProvider;
