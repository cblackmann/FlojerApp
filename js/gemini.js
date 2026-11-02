/**
 * Google Gemini API Service with Structured Outputs (JSON Schema)
 * Genera bancos de preguntas y flashcards garantizando formato estricto sin alucinaciones
 */
import { db } from './db.js';

export class GeminiService {
  constructor() {
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  async getApiKey() {
    return (await db.getSetting('gemini_api_key')) || '';
  }

  async getModel() {
    return (await db.getSetting('gemini_model')) || 'gemini-2.5-flash';
  }

  /**
   * JSON Schema estricto para Structured Outputs de Google Gemini
   */
  getQuestionsResponseSchema() {
    return {
      type: 'ARRAY',
      description: 'Lista de preguntas y flashcards estructuradas de alto rendimiento pedagógico',
      items: {
        type: 'OBJECT',
        properties: {
          pregunta: {
            type: 'STRING',
            description: 'Enunciado clínico, teórico o problema directo para activar memoria activa (Active Recall)'
          },
          tipo: {
            type: 'STRING',
            enum: ['multiple_choice', 'flashcard'],
            description: 'Tipo de evaluación (selección múltiple con 4 alternativas o flashcard conceptual)'
          },
          opciones: {
            type: 'ARRAY',
            description: 'Exactamente 4 alternativas de respuesta (A, B, C, D) para selección múltiple. Si es flashcard, puede quedar vacío.',
            items: { type: 'STRING' }
          },
          respuesta_correcta: {
            type: 'INTEGER',
            description: 'Índice base cero (0, 1, 2 o 3) de la opción correcta en el array de opciones'
          },
          explicacion_detallada: {
            type: 'STRING',
            description: 'Justificación paso a paso explicando por qué la correcta es acertada y el error pedagógico de las otras alternativas'
          },
          etiquetas: {
            type: 'ARRAY',
            description: 'Etiquetas temáticas breves (ej: fisiopatologia, farmacologia, calculo)',
            items: { type: 'STRING' }
          }
        },
        required: [
          'pregunta',
          'tipo',
          'opciones',
          'respuesta_correcta',
          'explicacion_detallada',
          'etiquetas'
        ]
      }
    };
  }

  /**
   * Genera un banco de preguntas y flashcards usando Gemini con Structured Outputs
   * @param {string} notesText Texto de clases, apuntes o esquema temático
   * @param {number} count Cantidad deseada de preguntas (ej. 5, 10)
   * @param {string} difficulty 'facil' | 'intermedio' | 'avanzado'
   * @returns {Promise<Array>} Lista de preguntas estructuradas listas para la base de datos
   */
  async generateQuestionBank(notesText, count = 5, difficulty = 'intermedio') {
    const apiKey = await this.getApiKey();
    const model = await this.getModel();

    if (!apiKey) {
      console.warn('Sin Gemini API Key configurada. Ejecutando generador pedagógico de prueba.');
      return this.mockGenerate(notesText, count);
    }

    const endpoint = `${this.baseUrl}/${model}:generateContent?key=${apiKey.trim()}`;

    const systemInstruction = `Eres un diseñador instruccional de élite y profesor universitario.
Tu objetivo es transformar el material de estudio en un banco de preguntas de selección múltiple (A, B, C, D) de alto rendimiento para técnicas de estudio activo (Active Recall) y repetición espaciada.

REGLAS CRÍTICAS:
1. Las preguntas deben evaluar comprensión profunda, aplicación práctica o casos clínicos, no memorización superficial.
2. Cada pregunta DEBE tener exactamente 4 alternativas plausibles (1 correcta y 3 distractores bien justificados).
3. "explicacion_detallada" DEBE desglosar de forma pedagógica por qué la opción acertada es la correcta y detallar el porqué cada distractor es incorrecto.
4. Responde ÚNICAMENTE en JSON válido cumpliendo estrictamente con el esquema provisto.`;

    const userPrompt = `Genera exactamente ${count} preguntas de evaluación de dificultad "${difficulty}" a partir del siguiente material:\n\n"""\n${notesText.slice(0, 15000)}\n"""`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        temperature: 0.35,
        responseMimeType: 'application/json',
        responseSchema: this.getQuestionsResponseSchema()
      }
    };

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `HTTP Error ${resp.status}`);
      }

      const data = await resp.json();
      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) {
        throw new Error('Respuesta vacía recibida desde Gemini API.');
      }

      const parsedQuestions = JSON.parse(rawJson);

      // Normalizar campos para compatibilidad con la base de datos
      return parsedQuestions.map((q, idx) => ({
        id: 'card_gen_' + Date.now() + '_' + idx,
        tipo: q.tipo || 'multiple_choice',
        pregunta: q.pregunta,
        opciones: Array.isArray(q.opciones) && q.opciones.length === 4 ? q.opciones : (q.opciones || ['A', 'B', 'C', 'D']),
        respuesta_correcta: typeof q.respuesta_correcta === 'number' ? q.respuesta_correcta : 0,
        explicacion_detallada: q.explicacion_detallada,
        etiquetas: q.etiquetas || ['Auto-Generado'],
        intervalo: 1,
        repeticiones: 0,
        facilidad: 2.50,
        proxima_revision: new Date().toISOString(),
        estado: 'new'
      }));

    } catch (err) {
      console.error('Error llamando a Gemini Structured Outputs:', err);
      throw err;
    }
  }

  /**
   * Generación mock de alta calidad para pruebas inmediatas sin API key
   */
  mockGenerate(notesText, count = 3) {
    const topicSummary = notesText.slice(0, 40).trim() || 'Conceptos Fundamentales';
    return [
      {
        id: 'card_mock_' + Date.now() + '_0',
        tipo: 'multiple_choice',
        pregunta: `Respecto al tema abordado ("${topicSummary}..."), ¿cuál es el mecanismo fisiopatológico o conceptual prioritario?`,
        opciones: [
          'Activación de una respuesta compensatoria primaria con regulación de retroalimentación',
          'Inhibición estocástica sin correlación biológica medible',
          'Bloqueo enzimático irreversible dependiente exclusivamente de la edad',
          'Ausencia de cambio cinético o adaptativo en el tejido blanco'
        ],
        respuesta_correcta: 0,
        explicacion_detallada: `• Opción A (CORRECTA): En los fundamentos de "${topicSummary}", la respuesta compensatoria es el pilar de estabilización.\n• Opción B (Incorrecta): Los procesos biológicos y teóricos presentan alta reproducibilidad y causalidad.\n• Opción C (Incorrecta): No depende de factores irreversibles aislados.\n• Opción D (Incorrecta): Se observa una clara variación cinética cuantificable.`,
        etiquetas: ['Mecanismo', 'Concepto Clave'],
        intervalo: 1,
        repeticiones: 0,
        facilidad: 2.50,
        proxima_revision: new Date().toISOString(),
        estado: 'new'
      },
      {
        id: 'card_mock_' + Date.now() + '_1',
        tipo: 'multiple_choice',
        pregunta: `¿Cuál de las siguientes intervenciones o principios se asocia con mayor tasa de éxito y evidencia en este ámbito?`,
        opciones: [
          'Monoterapia empírica sin estratificación de riesgo',
          'Abordaje multimodal basado en protocolos validados y control seriado',
          'Suspensión inmediata de todo tratamiento de soporte ante síntomas leves',
          'Aislamiento de variables sin verificación cruzada'
        ],
        respuesta_correcta: 1,
        explicacion_detallada: `• Opción A (Incorrecta): El abordaje empírico ciego tiene altas tasas de fallo.\n• Opción B (CORRECTA): La estratificación de riesgo y la terapia combinada protocolizada ofrecen los mejores desenlaces clínicos y experimentales.\n• Opción C (Incorrecta): El tratamiento debe ajustarse gradualmente.\n• Opción D (Incorrecta): La verificación cruzada es obligatoria.`,
        etiquetas: ['Terapéutica', 'Evidencia'],
        intervalo: 1,
        repeticiones: 0,
        facilidad: 2.50,
        proxima_revision: new Date().toISOString(),
        estado: 'new'
      }
    ].slice(0, count);
  }
}

export const gemini = new GeminiService();
