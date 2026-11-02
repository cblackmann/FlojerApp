/**
 * Google Gemini API Client
 * Connects directly to Google Generative Language API
 */
class GeminiService {
  constructor() {
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  getApiKey() {
    const settings = window.appStorage.getSettings();
    return settings.apiKey ? settings.apiKey.trim() : '';
  }

  getModel() {
    const settings = window.appStorage.getSettings();
    return settings.geminiModel || 'gemini-2.5-flash';
  }

  hasApiKey() {
    return Boolean(this.getApiKey());
  }

  async testApiKey(apiKey, model = 'gemini-2.5-flash') {
    if (!apiKey) throw new Error('Ingresa una API Key válida.');
    const url = `${this.baseUrl}/${model}:generateContent?key=${apiKey.trim()}`;
    const payload = {
      contents: [{ parts: [{ text: 'Hola, responde con "OK" para confirmar la conexión.' }] }],
      generationConfig: { maxOutputTokens: 20 }
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      const msg = errData?.error?.message || `Error ${resp.status}: ${resp.statusText}`;
      throw new Error(msg);
    }

    const data = await resp.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { success: true, reply };
  }

  async generate(prompt, { systemInstruction = '', temperature = 0.7, jsonMode = false } = {}) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Falta tu API Key de Google Gemini. Ve a Configuración (⚙️) para ingresarla.');
    }

    const model = this.getModel();
    const url = `${this.baseUrl}/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: 4096
      }
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    if (jsonMode) {
      body.generationConfig.responseMimeType = 'application/json';
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      const msg = errData?.error?.message || `Error HTTP ${resp.status}`;
      throw new Error(`Gemini API Error: ${msg}`);
    }

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('No se recibió texto de respuesta de Gemini.');
    }
    return text;
  }

  /**
   * AI Tutor Conversational Chat
   */
  async chatMessage(userMessage, history = [], contextDocument = '') {
    let systemInstruction = `Eres "Tutor IA FlojerApp", un tutor académico experto, pedagógico, motivador y claro.
Tu misión es ayudar al estudiante a comprender conceptos complejos, aclarar dudas de sus clases o lecturas, y poner a prueba su conocimiento.
Reglas:
1. Explica con claridad, usando analogías cotidianas cuando sea útil.
2. Organiza tus respuestas con formato Markdown limpio (negritas, viñetas, bloques de código si aplica).
3. Si el usuario te proporciona un fragmento de texto o PDF, básate principalmente en ese material.
4. Concluye con frecuencia con una pregunta socrática breve para verificar la comprensión del estudiante.
5. Sé conciso pero riguroso en tus explicaciones.`;

    if (contextDocument) {
      systemInstruction += `\n\n[CONTEXTO DE ESTUDIO DEL DOCUMENTO O APUNTES ACTUALES]:\n"""\n${contextDocument.slice(0, 8000)}\n"""`;
    }

    const contents = [];
    // Convert previous chat history
    for (const msg of history.slice(-8)) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    const apiKey = this.getApiKey();
    if (!apiKey) {
      return this.mockChatReply(userMessage, contextDocument);
    }

    const model = this.getModel();
    const url = `${this.baseUrl}/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Error ${resp.status}`);
    }

    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No pude generar una respuesta.';
  }

  /**
   * Generate Flashcards from Topic or Context
   */
  async generateFlashcards(topic, contextText = '', count = 5, difficulty = 'intermedio') {
    const prompt = `Actúa como diseñador pedagógico y experto en el tema "${topic}".
Genera exactamente ${count} flashcards de estudio de nivel "${difficulty}" para repasar y memorizar conceptos clave.
${contextText ? `Basado en el siguiente texto de referencia:\n"""${contextText.slice(0, 6000)}"""\n` : ''}

Devuelve ÚNICAMENTE un arreglo JSON con el siguiente formato estricto:
[
  {
    "front": "Pregunta o concepto clave para el anverso (directo y desafiante)",
    "back": "Respuesta clara, concisa y explicativa para el reverso",
    "hint": "Pista breve mnemotécnica o clave para recordar"
  }
]`;

    const systemInstruction = 'Eres un generador de flashcards para técnicas de estudio activo y repetición espaciada. Responde ÚNICAMENTE en JSON válido sin markdown alrededor.';

    if (!this.hasApiKey()) {
      return this.mockFlashcards(topic, count);
    }

    try {
      const raw = await this.generate(prompt, { systemInstruction, jsonMode: true, temperature: 0.5 });
      const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
      const cards = JSON.parse(cleaned);
      return cards.map((c, i) => ({
        id: 'fc_gen_' + Date.now() + '_' + i,
        front: c.front || 'Pregunta',
        back: c.back || 'Respuesta',
        hint: c.hint || '',
        state: 'new',
        reviews: 0,
        lastReviewed: null
      }));
    } catch (e) {
      console.error('Error generating flashcards with Gemini:', e);
      return this.mockFlashcards(topic, count);
    }
  }

  /**
   * Generate Multiple-Choice Quiz Questions
   */
  async generateQuiz(topic, contextText = '', count = 5, difficulty = 'intermedio') {
    const prompt = `Actúa como profesor evaluador y experto en "${topic}".
Genera exactamente ${count} preguntas de opción múltiple (selección múltiple) de nivel "${difficulty}".
${contextText ? `Basado en el siguiente texto:\n"""${contextText.slice(0, 6000)}"""\n` : ''}

Cada pregunta DEBE tener:
1. "question": Enunciado clínico o conceptual de alta calidad.
2. "options": Un arreglo con exactamente 4 opciones de texto (A, B, C, D).
3. "correctIndex": Índice numérico (0, 1, 2 o 3) de la opción correcta.
4. "explanation": Explicación pedagógica de por qué la correcta es la acertada y por qué las demás son erróneas.

Devuelve ÚNICAMENTE un arreglo JSON con el siguiente formato estricto:
[
  {
    "question": "¿...?",
    "options": ["Opción 1", "Opción 2", "Opción 3", "Opción 4"],
    "correctIndex": 0,
    "explanation": "Explicación detallada..."
  }
]`;

    const systemInstruction = 'Eres un generador de exámenes tipo selección múltiple riguroso y educativo. Responde ÚNICAMENTE en formato JSON válido sin markdown.';

    if (!this.hasApiKey()) {
      return this.mockQuiz(topic, count);
    }

    try {
      const raw = await this.generate(prompt, { systemInstruction, jsonMode: true, temperature: 0.4 });
      const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
      const questions = JSON.parse(cleaned);
      return questions.map((q, i) => ({
        id: 'q_gen_' + Date.now() + '_' + i,
        question: q.question,
        options: q.options || ['A', 'B', 'C', 'D'],
        correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
        explanation: q.explanation || 'Respuesta correcta analizada por FlojerApp.'
      }));
    } catch (e) {
      console.error('Error generating quiz with Gemini:', e);
      return this.mockQuiz(topic, count);
    }
  }

  // Fallbacks for testing without API Key immediately
  mockChatReply(userMessage, context) {
    return `*(Modo de prueba sin API Key activa)*\n\n¡Hola! He recibido tu consulta: **"${userMessage}"**.\n\n${context ? `> He detectado contexto activo de tu documento PDF/apuntes (${context.slice(0, 120)}...)\n\n` : ''}Para habilitar respuestas personalizadas completas impulsadas por **Google Gemini 2.5 Flash**, ingresa tu clave en el botón de **⚙️ Configuración** arriba a la derecha. Puedes obtener una clave gratuita en [Google AI Studio](https://aistudio.google.com/).\n\n¿Deseas que te muestre cómo estructurar un plan de repaso activo mientras tanto?`;
  }

  mockFlashcards(topic, count = 3) {
    return [
      {
        id: 'fc_mock_1',
        front: `¿Cuál es el concepto nuclear de: ${topic}?`,
        back: `Es el principio rector que describe cómo se articulan los componentes y procesos principales de ${topic}.`,
        hint: 'Enfócate en la definición fundamental.',
        state: 'new',
        reviews: 0,
        lastReviewed: null
      },
      {
        id: 'fc_mock_2',
        front: `Menciona dos aplicaciones o ejemplos clave en ${topic}`,
        back: '1. Diagnóstico/Análisis predictivo en situaciones prácticas.\n2. Optimización de toma de decisiones bajo criterios estandarizados.',
        hint: 'Piensa en casos de uso reales.',
        state: 'new',
        reviews: 0,
        lastReviewed: null
      },
      {
        id: 'fc_mock_3',
        front: `¿Qué error o distractor común se debe evitar al estudiar ${topic}?`,
        back: 'Confundir la causa primaria con efectos secundarios o correlaciones aisladas sin causalidad demostrada.',
        hint: 'Causalidad vs. correlación.',
        state: 'new',
        reviews: 0,
        lastReviewed: null
      }
    ].slice(0, count);
  }

  mockQuiz(topic, count = 3) {
    return [
      {
        id: 'q_mock_1',
        question: `Respecto a "${topic}", ¿cuál de los siguientes enunciados representa la afirmación teórica más acertada?`,
        options: [
          `Los principios fundamentales de ${topic} se aplican de forma sistemática y reproducible`,
          `No existe evidencia ni metodología estructurada para ${topic}`,
          `Es un fenómeno puramente aleatorio sin correlación comprobable`,
          `Solo tiene relevancia histórica y ya no se utiliza en la práctica`
        ],
        correctIndex: 0,
        explanation: `La opción 1 es correcta porque la comprensión actual de ${topic} se sustenta en principios validados empíricamente.`
      },
      {
        id: 'q_mock_2',
        question: `¿Qué factor resulta crítico para optimizar el rendimiento y retención al abordar "${topic}"?`,
        options: [
          'La lectura pasiva sin preguntas ni autoevaluación',
          'La práctica activa con espaciamiento temporal y resolución de problemas',
          'Memorizar sin comprender los fundamentos de base',
          'Evitar repasar los temas más difíciles'
        ],
        correctIndex: 1,
        explanation: 'La práctica activa y la repetición espaciada son las técnicas de estudio con mayor evidencia científica en aprendizaje duradero.'
      }
    ].slice(0, count);
  }
}

window.geminiService = new GeminiService();
