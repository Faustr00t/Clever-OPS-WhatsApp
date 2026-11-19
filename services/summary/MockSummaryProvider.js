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

        let solutions = '';
        if (topic.includes('reporte')) {
            solutions = [
                '• Definir el formato del reporte (PDF/Excel) y los indicadores clave a incluir.',
                '• Compartir un borrador previo hoy por la tarde para evitar correcciones de último minuto.',
                '• Fijar una hora límite de entrega mañana para la revisión final del equipo.'
            ].join('\n');
        } else if (topic.includes('reunión')) {
            solutions = [
                '• Enviar invitación de calendario con enlace de videollamada y orden del día.',
                '• Confirmar disponibilidad de los participantes con 1 hora de anticipación.',
                '• Designar a un responsable para registrar la minuta y acuerdos al finalizar.'
            ].join('\n');
        } else if (topic.includes('pagos')) {
            solutions = [
                '• Validar los datos fiscales y número de cuenta antes de ejecutar la transacción.',
                '• Compartir el comprobante en este chat para agilizar la conciliación contable.',
                '• Registrar la fecha de pago en el calendario para evitar recargos.'
            ].join('\n');
        } else {
            solutions = [
                '• Asignar un responsable directo para el seguimiento de los acuerdos tratados.',
                '• Acordar un plazo de respuesta claro entre los participantes involucrados.',
                '• Notificar en este chat en cuanto se complete la siguiente acción acordada.'
            ].join('\n');
        }

        const rawSummary = [
            `Tema principal: ${topic}.`,
            `Participantes: ${participantsStr}.`,
            `Pendientes: ${pending}.`,
            `Fecha detectada: ${date}.`,
            `\nPosibles soluciones:\n${solutions}`
        ].join('\n');

        return {
            topic,
            participants: uniqueSenders,
            pendingTasks: pending,
            detectedDates: date,
            solutions,
            rawSummary
        };
    }
}

module.exports = MockSummaryProvider;
