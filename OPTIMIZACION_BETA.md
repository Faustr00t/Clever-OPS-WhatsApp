# Reporte de optimización beta

## Cuellos de botella revisados

- Cada mensaje nuevo provocaba una consulta completa de chats, la resolución de nombres y el renderizado de toda la lista.
- Cada render de chats creaba un listener por elemento.
- La lista de mensajes podía crecer sin límite en memoria mientras un chat permanecía abierto.
- El botón del resumen permitía solicitudes repetidas.
- El QR ya tenía un spinner y la multimedia ya requería una acción explícita para descargarse.

## Cambios realizados

- Agrupé los refrescos de chats que llegan en una ráfaga con una espera de 250 ms. Esto conserva la actualización en tiempo real con un pequeño retraso y evita repetir `getChats()` por cada mensaje.
- Rendericé la lista mediante `DocumentFragment` y delegué el clic en un listener del contenedor.
- Evité pedir dos veces el historial del mismo chat mientras la primera carga sigue pendiente.
- Evité volver a asignar la misma URL del QR al elemento de imagen.
- Evité añadir dos veces el mismo mensaje por ID.
- El historial se carga en bloques de 50, con un botÃ³n para traer mensajes anteriores sin lÃ­mite total.
- Deshabilité el botón del resumen mientras la solicitud está en curso y mostré “Generando resumen...”.
- Conservé el proveedor y los prompts de IA, la autenticación, la sesión local, los tipos multimedia y la carga de multimedia bajo demanda.

## Riesgos y límites

- La lista lateral puede tardar hasta 250 ms en reflejar mensajes nuevos durante actividad continua; el mensaje aparece de inmediato en el chat abierto.
- Los historiales muy extensos pueden aumentar el tiempo de apertura, la memoria usada por WhatsApp Web y el volumen enviado a la IA.
- Al recorrer muchos bloques, la cantidad de mensajes en el DOM crece; si afecta la fluidez, conviene virtualizar la lista manteniendo accesible el historial completo.
- Los resultados de rendimiento dependen del tamaño de la cuenta y del equipo que ejecuta WhatsApp Web.

## Recomendaciones futuras

- Medir duración de `getChats()`, `formatChats()` y renderizado con cuentas de distintos tamaños antes de considerar virtualización.
- Si la lista lateral sigue siendo lenta, cachear nombres de contactos con una estrategia de actualización al cambiar el nombre del chat.
- Medir apertura de conversaciones extensas y, si hace falta, añadir carga por bloques o virtualización visual sin imponer un límite total.

No se ejecutaron pruebas automatizadas.
