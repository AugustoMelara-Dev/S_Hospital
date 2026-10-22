import { z } from 'zod';
import es from 'zod/v4/locales/es.js';

/**
 * Mensajes de validación en español para todo esquema Zod que no declare uno
 * propio. Sin esto, un campo sin mensaje explícito mostraría el texto por
 * defecto en inglés («Expected number, received nan»). Solo se importa la
 * locale española para no cargar el resto en el paquete.
 */
z.config(es());
