/**
 * Storage Service - LocalStorage persistence and data management
 */
const STORAGE_KEYS = {
  SETTINGS: 'flojerapp_settings',
  CALENDAR_EVENTS: 'flojerapp_calendar_events',
  FLASHCARD_DECKS: 'flojerapp_flashcard_decks',
  QUIZ_DECKS: 'flojerapp_quiz_decks',
  HIGHLIGHTS: 'flojerapp_highlights',
  CHAT_HISTORY: 'flojerapp_chat_history'
};

const DEFAULT_SETTINGS = {
  apiKey: '',
  geminiModel: 'gemini-2.5-flash',
  theme: 'dark',
  soundEnabled: true,
  notificationsEnabled: true
};

const DEFAULT_EVENTS = [
  {
    id: 'evt_sample_1',
    title: 'Examen de Fisiología Médica',
    date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    time: '09:00',
    category: 'examen',
    notes: 'Repasar conceptos clave de sistema cardiovascular y renal.',
    reminderMinutes: 60,
    notified: false
  },
  {
    id: 'evt_sample_2',
    title: 'Sesión intensiva: Flashcards Farmacología',
    date: new Date(Date.now() + 86400000 * 1).toISOString().split('T')[0],
    time: '18:00',
    category: 'estudio',
    notes: 'Completar meta diaria de 25 tarjetas.',
    reminderMinutes: 30,
    notified: false
  }
];

const DEFAULT_FLASHCARDS = [
  {
    id: 'deck_cardio',
    title: 'Cardiología: Insuficiencia Cardíaca',
    category: 'Medicina',
    description: 'Fisiopatología, diagnóstico y terapia médica óptima.',
    cards: [
      {
        id: 'fc_1',
        front: '¿Cuáles son los 4 pilares farmacológicos en ICC con fracción de eyección reducida (IC-FEr)?',
        back: '1. Inhibidores de SGLT2 (iSGLT2: Dapagliflozina / Empagliflozina)\n2. Betabloqueadores (Carvedilol, Bisoprolol, Metoprolol succinato)\n3. ARNI (Sacubitril/Valsartán) o IECA/ARA-II\n4. Antagonistas de receptores mineralocorticoides (ARM: Espironolactona / Eplerenona)',
        hint: 'Son conocidos como los "Cuatro Fantásticos" según las guías clínicas.',
        state: 'learning',
        reviews: 2,
        lastReviewed: Date.now()
      },
      {
        id: 'fc_2',
        front: '¿Qué biomarcador es el estándar de oro para descartar insuficiencia cardíaca aguda?',
        back: 'NT-proBNP o BNP sérico (tienen un altísimo valor predictivo negativo para disnea aguda de origen cardíaco).',
        hint: 'Péptido natriurético tipo B.',
        state: 'mastered',
        reviews: 4,
        lastReviewed: Date.now()
      },
      {
        id: 'fc_3',
        front: '¿Cuál es el mecanismo de acción de Sacubitril en el complejo ARNI?',
        back: 'Inhibe la enzima neprilisina, impidiendo la degradación de péptidos natriuréticos endógenos (BNP, ANP, bradicinina), promoviendo vasodilatación, natriuresis y reduciendo el remodelado adverso.',
        hint: 'Inhibidor de neprilisina.',
        state: 'new',
        reviews: 0,
        lastReviewed: null
      }
    ]
  }
];

const DEFAULT_QUIZZES = [
  {
    id: 'quiz_cardio',
    title: 'Quiz Rápido: Fisiopatología y Terapéutica Cardíaca',
    category: 'Cardiología',
    description: 'Preguntas tipo selección múltiple con retroalimentación detallada.',
    questions: [
      {
        id: 'q_1',
        question: 'Un paciente de 62 años con IC-FEr (FEVI 28%) en tratamiento con Enalapril y Carvedilol persiste sintomático en clase funcional NYHA III. ¿Cuál es la conducta terapéutica más indicada?',
        options: [
          'Suspender Carvedilol e iniciar Digoxina inmediatamente',
          'Sustituir Enalapril por Sacubitril/Valsartán (ARNI) tras un periodo de lavado de 36 horas, y añadir un iSGLT2 y ARM',
          'Aumentar la ingesta de sodio y líquidos para mejorar precarga',
          'Indicar reposo absoluto en cama sin cambios farmacológicos'
        ],
        correctIndex: 1,
        explanation: 'En pacientes con IC-FEr sintomáticos bajo IECA, las guías internacionales recomiendan el cambio a ARNI (respetando las 36h de lavado para evitar angioedema) junto a la cuadruple terapia (iSGLT2 + ARM + BB + ARNI).'
      },
      {
        id: 'q_2',
        question: '¿Qué efecto adverso característico y potencialmente letal debe monitorizarse al usar Espironolactona junto a un IECA o ARA-II?',
        options: [
          'Hipopotasemia severa',
          'Hiperpotasemia (hiperkalemia)',
          'Hipoglucemia reactiva',
          'Hipercalcemia idiopática'
        ],
        correctIndex: 1,
        explanation: 'La espironolactona es un diurético ahorrador de potasio al bloquear los receptores de aldosterona. Su combinación con fármacos que bloquean el sistema renina-angiotensina aumenta marcadamente el riesgo de hiperkalemia.'
      },
      {
        id: 'q_3',
        question: '¿Cuál de los siguientes fármacos demostró reducir hospitalizaciones y muerte cardiovascular en pacientes con IC, independientemente de si presentan diabetes o de su FEVI?',
        options: [
          'Dapagliflozina (iSGLT2)',
          'Glibenclamida (Sulfonilurea)',
          'Metformina',
          'Insulina NPH'
        ],
        correctIndex: 0,
        explanation: 'Los inhibidores del cotransportador sodio-glucosa 2 (iSGLT2) como Dapagliflozina y Empagliflozina demostraron un beneficio pronóstico sólido en IC con FEVI reducida y preservada, independientemente del estado glucémico.'
      }
    ]
  }
];

class StorageService {
  constructor() {
    this.init();
  }

  init() {
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      this.saveSettings(DEFAULT_SETTINGS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CALENDAR_EVENTS)) {
      this.saveEvents(DEFAULT_EVENTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.FLASHCARD_DECKS)) {
      this.saveFlashcards(DEFAULT_FLASHCARDS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.QUIZ_DECKS)) {
      this.saveQuizzes(DEFAULT_QUIZZES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.HIGHLIGHTS)) {
      this.saveHighlights([]);
    }
  }

  // Settings
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch (e) {
      console.error('Error reading settings', e);
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  // Calendar
  getEvents() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CALENDAR_EVENTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveEvents(events) {
    localStorage.setItem(STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(events));
  }

  addEvent(event) {
    const events = this.getEvents();
    events.push(event);
    this.saveEvents(events);
    return event;
  }

  deleteEvent(id) {
    const events = this.getEvents().filter(e => e.id !== id);
    this.saveEvents(events);
  }

  updateEvent(updated) {
    const events = this.getEvents().map(e => e.id === updated.id ? updated : e);
    this.saveEvents(events);
  }

  // Flashcards
  getFlashcardDecks() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FLASHCARD_DECKS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveFlashcards(decks) {
    localStorage.setItem(STORAGE_KEYS.FLASHCARD_DECKS, JSON.stringify(decks));
  }

  saveDeck(deck) {
    const decks = this.getFlashcardDecks();
    const index = decks.findIndex(d => d.id === deck.id);
    if (index >= 0) {
      decks[index] = deck;
    } else {
      decks.push(deck);
    }
    this.saveFlashcards(decks);
  }

  deleteDeck(id) {
    const decks = this.getFlashcardDecks().filter(d => d.id !== id);
    this.saveFlashcards(decks);
  }

  // Quizzes
  getQuizzes() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUIZ_DECKS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveQuizzes(quizzes) {
    localStorage.setItem(STORAGE_KEYS.QUIZ_DECKS, JSON.stringify(quizzes));
  }

  saveQuiz(quiz) {
    const quizzes = this.getQuizzes();
    const index = quizzes.findIndex(q => q.id === quiz.id);
    if (index >= 0) {
      quizzes[index] = quiz;
    } else {
      quizzes.push(quiz);
    }
    this.saveQuizzes(quizzes);
  }

  deleteQuiz(id) {
    const quizzes = this.getQuizzes().filter(q => q.id !== id);
    this.saveQuizzes(quizzes);
  }

  // Highlights
  getHighlights(docId = null) {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HIGHLIGHTS);
      const all = data ? JSON.parse(data) : [];
      return docId ? all.filter(h => h.docId === docId) : all;
    } catch (e) {
      return [];
    }
  }

  saveHighlights(highlights) {
    localStorage.setItem(STORAGE_KEYS.HIGHLIGHTS, JSON.stringify(highlights));
  }

  addHighlight(highlight) {
    const highlights = this.getHighlights();
    highlights.push(highlight);
    this.saveHighlights(highlights);
    return highlight;
  }

  deleteHighlight(id) {
    const highlights = this.getHighlights().filter(h => h.id !== id);
    this.saveHighlights(highlights);
  }

  // Full backup
  exportAllData() {
    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings: this.getSettings(),
      events: this.getEvents(),
      flashcards: this.getFlashcardDecks(),
      quizzes: this.getQuizzes(),
      highlights: this.getHighlights()
    }, null, 2);
  }

  importAllData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.settings) this.saveSettings(data.settings);
      if (data.events) this.saveEvents(data.events);
      if (data.flashcards) this.saveFlashcards(data.flashcards);
      if (data.quizzes) this.saveQuizzes(data.quizzes);
      if (data.highlights) this.saveHighlights(data.highlights);
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  }
}

window.appStorage = new StorageService();
