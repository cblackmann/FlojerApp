/**
 * IndexedDB Local Database & Supabase Sync Engine
 * Soporte Offline-first para Progressive Web App (PWA)
 */
const DB_NAME = 'FlojerApp_PWA_Database';
const DB_VERSION = 1;

const SEED_FOLDERS = [
  {
    id: 'folder_cardio',
    title: 'Cardiología & Fisiología',
    description: 'Insuficiencia cardíaca, antiarrítmicos y farmacología cardiovascular.',
    icon: '🫀',
    color: '#ef4444',
    created_at: new Date().toISOString()
  },
  {
    id: 'folder_neuro',
    title: 'Neurología & Neuroanatomía',
    description: 'Vías motoras, sensitivas y accidentes cerebrovasculares.',
    icon: '🧠',
    color: '#8b5cf6',
    created_at: new Date().toISOString()
  }
];

const SEED_CARDS = [
  {
    id: 'card_seed_1',
    folder_id: 'folder_cardio',
    tipo: 'multiple_choice',
    pregunta: '¿Cuál de las siguientes combinaciones farmacológicas constituye la "cuádruple terapia" estándar en Insuficiencia Cardíaca con Fracción de Eyección Reducida (IC-FEr)?',
    opciones: [
      'Digoxina + Furosemida + Enalapril + Espironolactona',
      'ARNI (Sacubitril/Valsartán) + Betabloqueador + ARM + iSGLT2',
      'Amlodipino + Losartán + Hidroclorotiazida + Nitratos',
      'Aspirina + Clopidogrel + Atorvastatina + Metoprolol'
    ],
    respuesta_correcta: 1,
    explicacion_detallada: `• Opción A (Incorrecta): La digoxina y furosemida controlan síntomas y congestión, pero no demostraron reducción global de mortalidad como pilar inicial.\n• Opción B (CORRECTA): Los 4 pilares fundamentales con beneficio demostrado en sobrevida son: ARNI (o IECA), Betabloqueadores (Carvedilol/Bisoprolol), Antagonistas del Receptor Mineralocorticoide (ARM: Espironolactona) e Inhibidores de SGLT2 (Dapagliflozina/Empagliflozina).\n• Opción C (Incorrecta): Los bloqueadores de canales de calcio dihidropiridínicos no reducen mortalidad en IC-FEr.\n• Opción D (Incorrecta): Es el esquema para prevención secundaria aterotrombótica, no el cuarteto neurohormonal de la IC-FEr.`,
    etiquetas: ['ICC', 'Farmacología', 'Guías Clínicas'],
    intervalo: 1,
    repeticiones: 0,
    facilidad: 2.50,
    proxima_revision: new Date(Date.now() - 3600000).toISOString(), // Vencida hoy para prueba inmediata
    estado: 'new'
  },
  {
    id: 'card_seed_2',
    folder_id: 'folder_cardio',
    tipo: 'multiple_choice',
    pregunta: '¿Por qué se requiere un periodo de lavado estricto de 36 horas al cambiar de un IECA (como Enalapril) a un ARNI (Sacubitril/Valsartán)?',
    opciones: [
      'Para evitar hipotensión ortostática fulminante por exceso de vasodilatación',
      'Para prevenir el riesgo de angioedema potencialmente fatal por acumulación de bradicinina',
      'Para evitar fallo renal agudo irreversible por hipoperfusión glomerular',
      'Para permitir que la fracción de eyección se estabilice antes de la nueva dosis'
    ],
    respuesta_correcta: 1,
    explicacion_detallada: `• Opción A (Incorrecta): Aunque puede existir hipotensión, no es el factor de riesgo crítico que dicta las 36 horas de espera.\n• Opción B (CORRECTA): Tanto los IECA como la neprilisina degradan la bradicinina. Bloquear ambas vías de forma simultánea provoca una acumulación tóxica masiva de bradicinina, desencadenando angioedema de vía aérea grave.\n• Opción C (Incorrecta): La función renal se monitoriza, pero el periodo de lavado específico de 36 horas es exclusivamente por seguridad inmunológica/bradicinina.\n• Opción D (Incorrecta): La FEVI no se estabiliza en 36 horas.`,
    etiquetas: ['ARNI', 'Seguridad Clínica', 'Neprilisina'],
    intervalo: 1,
    repeticiones: 0,
    facilidad: 2.50,
    proxima_revision: new Date(Date.now() - 7200000).toISOString(),
    estado: 'new'
  },
  {
    id: 'card_seed_3',
    folder_id: 'folder_neuro',
    tipo: 'multiple_choice',
    pregunta: 'Un paciente presenta hemiplejía contralateral respetando la mitad superior de la cara y afectando preferentemente el miembro superior y el lenguaje (afasia de Broca). ¿Qué vaso arterial se encuentra con mayor probabilidad ocluido?',
    opciones: [
      'Arteria Cerebral Anterior (ACA)',
      'Arteria Cerebral Media (ACM), división superior',
      'Arteria Cerebral Posterior (ACP)',
      'Arteria Basilar distal'
    ],
    respuesta_correcta: 1,
    explicacion_detallada: `• Opción A (Incorrecta): La oclusión de la ACA afecta predominantemente el miembro inferior (homúnculo motor medial).\n• Opción B (CORRECTA): La división superior de la ACM irriga la corteza frontal dorsolateral y el área motora primaria de cara/brazo, además del área motora del lenguaje (Broca).\n• Opción C (Incorrecta): La ACP genera principalmente déficit visual (hemianopsia homónima) y sensorial talámico.\n• Opción D (Incorrecta): El síndrome basilar cursa con alteración del tronco encefálico, signos cruzados y compromiso de conciencia.`,
    etiquetas: ['ACV', 'Neuroanatomía', 'Cerebral Media'],
    intervalo: 1,
    repeticiones: 0,
    facilidad: 2.50,
    proxima_revision: new Date(Date.now() - 1800000).toISOString(),
    estado: 'new'
  }
];

export class DatabaseService {
  constructor() {
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Folders store
        if (!db.objectStoreNames.contains('folders')) {
          const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
          folderStore.createIndex('title', 'title', { unique: false });
        }

        // Cards store
        if (!db.objectStoreNames.contains('cards')) {
          const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
          cardStore.createIndex('folder_id', 'folder_id', { unique: false });
          cardStore.createIndex('proxima_revision', 'proxima_revision', { unique: false });
          cardStore.createIndex('estado', 'estado', { unique: false });
        }

        // Reviews log store
        if (!db.objectStoreNames.contains('reviews_log')) {
          const logStore = db.createObjectStore('reviews_log', { keyPath: 'id' });
          logStore.createIndex('card_id', 'card_id', { unique: false });
          logStore.createIndex('reviewed_at', 'reviewed_at', { unique: false });
        }

        // Metrics store
        if (!db.objectStoreNames.contains('metrics')) {
          db.createObjectStore('metrics', { keyPath: 'id' });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = async (e) => {
        this.db = e.target.result;
        await this.ensureSeedData();
        resolve(this.db);
      };

      request.onerror = (e) => reject(e.target.error);
    });
  }

  async ensureSeedData() {
    const folders = await this.getFolders();
    if (folders.length === 0) {
      for (const f of SEED_FOLDERS) await this.saveFolder(f);
      for (const c of SEED_CARDS) await this.saveCard(c);
      await this.saveMetrics({
        id: 'user_default',
        racha_dias: 3,
        ultimo_estudio_fecha: new Date().toISOString().split('T')[0],
        meta_diaria: 20,
        total_repasos: 14,
        total_aciertos: 12
      });
    }
  }

  // --- FOLDERS ---
  async getFolders() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('folders', 'readonly');
      const req = tx.objectStore('folders').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async saveFolder(folder) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('folders', 'readwrite');
      const item = {
        ...folder,
        id: folder.id || 'fld_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        created_at: folder.created_at || new Date().toISOString()
      };
      const req = tx.objectStore('folders').put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteFolder(id) {
    const db = await this.open();
    // Delete folder and its cards
    const cards = await this.getCards(id);
    for (const c of cards) {
      await this.deleteCard(c.id);
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction('folders', 'readwrite');
      const req = tx.objectStore('folders').delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // --- CARDS ---
  async getCards(folderId = null) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cards', 'readonly');
      const store = tx.objectStore('cards');
      const req = folderId ? store.index('folder_id').getAll(folderId) : store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getDueCards(folderId = null) {
    const all = await this.getCards(folderId);
    const now = new Date();
    return all.filter(c => {
      if (!c.proxima_revision) return true;
      return new Date(c.proxima_revision) <= now;
    });
  }

  async getCardById(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cards', 'readonly');
      const req = tx.objectStore('cards').get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async saveCard(card) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cards', 'readwrite');
      const item = {
        ...card,
        id: card.id || 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        created_at: card.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const req = tx.objectStore('cards').put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  }

  async saveBatchCards(cardsArray) {
    const saved = [];
    for (const card of cardsArray) {
      const res = await this.saveCard(card);
      saved.push(res);
    }
    return saved;
  }

  async deleteCard(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cards', 'readwrite');
      const req = tx.objectStore('cards').delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // --- REVIEWS & LOGS ---
  async logReview(cardId, grade, responseTimeMs, isCorrect, srsUpdate) {
    const db = await this.open();
    // 1. Update the card with SRS parameters
    const card = await this.getCardById(cardId);
    if (card) {
      Object.assign(card, srsUpdate);
      await this.saveCard(card);
    }

    // 2. Log entry for telemetry
    const logEntry = {
      id: 'log_' + Date.now(),
      card_id: cardId,
      calificacion: grade,
      tiempo_respuesta_ms: responseTimeMs,
      acierto: isCorrect,
      reviewed_at: new Date().toISOString()
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction('reviews_log', 'readwrite');
      const req = tx.objectStore('reviews_log').put(logEntry);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });

    // 3. Update user metrics & streak
    await this.registerStudyActivity(isCorrect);
  }

  // --- METRICS & STREAK ---
  async getMetrics() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('metrics', 'readonly');
      const req = tx.objectStore('metrics').get('user_default');
      req.onsuccess = () => resolve(req.result || {
        id: 'user_default',
        racha_dias: 0,
        ultimo_estudio_fecha: null,
        meta_diaria: 20,
        total_repasos: 0,
        total_aciertos: 0
      });
      req.onerror = () => reject(req.error);
    });
  }

  async saveMetrics(metrics) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('metrics', 'readwrite');
      const req = tx.objectStore('metrics').put({ ...metrics, id: 'user_default' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async registerStudyActivity(isCorrect) {
    const metrics = await this.getMetrics();
    const todayStr = new Date().toISOString().split('T')[0];

    metrics.total_repasos = (metrics.total_repasos || 0) + 1;
    if (isCorrect) {
      metrics.total_aciertos = (metrics.total_aciertos || 0) + 1;
    }

    if (metrics.ultimo_estudio_fecha !== todayStr) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (metrics.ultimo_estudio_fecha === yesterday) {
        metrics.racha_dias = (metrics.racha_dias || 0) + 1;
      } else if (!metrics.ultimo_estudio_fecha) {
        metrics.racha_dias = 1;
      } else {
        metrics.racha_dias = 1; // Racha reiniciada
      }
      metrics.ultimo_estudio_fecha = todayStr;
    }

    await this.saveMetrics(metrics);
  }

  // --- SETTINGS ---
  async getSetting(key, defaultValue = null) {
    const db = await this.open();
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
      req.onerror = () => resolve(defaultValue);
    });
  }

  async setSetting(key, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const req = tx.objectStore('settings').put({ key, value });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
}

export const db = new DatabaseService();
