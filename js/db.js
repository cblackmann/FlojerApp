/**
 * Database Service - Hybrid Supabase Cloud & IndexedDB Offline Engine
 */
const SUPABASE_CONFIG = {
  url: 'https://baqutfhgejurfxibozxc.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcXV0ZmhnZWp1cmZ4aWJvenhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTgzOTUsImV4cCI6MjEwOTIzNDM5NX0.tOWjKHPrUDHfkyu9BaRNMiMP_Z7XawlfZk5v_JKs5GM'
};

const DB_NAME = 'FlojerApp_Database_v2';
const DB_VERSION = 1;

export class DatabaseService {
  constructor() {
    this.db = null;
    this.supabase = null;
    this.initSupabase();
  }

  initSupabase() {
    if (window.supabase) {
      try {
        this.supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        console.log('✅ Conexión con Supabase establecida.');
      } catch (err) {
        console.warn('No se pudo inicializar cliente Supabase:', err);
      }
    }
  }

  async open() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('cards')) {
          const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
          cardStore.createIndex('folder_id', 'folder_id', { unique: false });
        }
        if (!db.objectStoreNames.contains('documents')) {
          const docStore = db.createObjectStore('documents', { keyPath: 'id' });
          docStore.createIndex('folder_id', 'folder_id', { unique: false });
        }
        if (!db.objectStoreNames.contains('pdf_blobs')) db.createObjectStore('pdf_blobs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('reviews_log')) db.createObjectStore('reviews_log', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('metrics')) db.createObjectStore('metrics', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      };

      request.onsuccess = async (e) => {
        this.db = e.target.result;
        await this.syncFromSupabase();
        resolve(this.db);
      };

      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Sincroniza datos iniciales desde Supabase al caché local
   */
  async syncFromSupabase() {
    if (!this.supabase) return;
    try {
      const { data: cloudFolders } = await this.supabase.from('folders').select('*');
      if (cloudFolders && cloudFolders.length > 0) {
        for (const f of cloudFolders) await this.saveLocal('folders', f);
      }

      const { data: cloudCards } = await this.supabase.from('cards').select('*');
      if (cloudCards && cloudCards.length > 0) {
        for (const c of cloudCards) await this.saveLocal('cards', c);
      }

      const { data: cloudDocs } = await this.supabase.from('documents').select('*');
      if (cloudDocs && cloudDocs.length > 0) {
        for (const d of cloudDocs) await this.saveLocal('documents', d);
      }
    } catch (err) {
      console.warn('Sync inicial con Supabase falló (modo offline):', err);
    }
  }

  // --- REPOSITORIO LOCAL (INDEXEDDB) ---
  async saveLocal(storeName, item) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllLocal(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // --- CARPETAS / ASIGNATURAS ---
  async getFolders() {
    let folders = await this.getAllLocal('folders');
    if (folders.length === 0 && this.supabase) {
      const { data } = await this.supabase.from('folders').select('*');
      if (data && data.length > 0) {
        for (const f of data) await this.saveLocal('folders', f);
        folders = data;
      }
    }

    // Semilla inicial si está completamente vacía
    if (folders.length === 0) {
      const initialFolder = {
        id: 'fld_cardio',
        title: 'Cardiología & Fisiología',
        description: 'Insuficiencia cardíaca, antiarrítmicos y farmacología cardiovascular.',
        icon: '🫀',
        color: '#ef4444',
        created_at: new Date().toISOString()
      };
      await this.saveFolder(initialFolder);
      folders = [initialFolder];
    }

    return folders;
  }

  async saveFolder(folder) {
    const item = {
      ...folder,
      id: folder.id || 'fld_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      created_at: folder.created_at || new Date().toISOString()
    };

    // Guardar en IndexedDB
    await this.saveLocal('folders', item);

    // Guardar en Supabase en segundo plano
    if (this.supabase) {
      this.supabase.from('folders').upsert(item).then(({ error }) => {
        if (error) console.warn('Supabase folder upsert error:', error);
      });
    }

    return item;
  }

  async deleteFolder(id) {
    const db = await this.open();
    await new Promise((resolve) => {
      const tx = db.transaction('folders', 'readwrite');
      tx.objectStore('folders').delete(id);
      tx.oncomplete = () => resolve();
    });

    if (this.supabase) {
      this.supabase.from('folders').delete().eq('id', id).then();
    }
    return true;
  }

  // --- DOCUMENTOS PDF & STORAGE ---
  async getDocuments(folderId = null) {
    const all = await this.getAllLocal('documents');
    return folderId ? all.filter(d => d.folder_id === folderId) : all;
  }

  async getPdfData(docId) {
    const db = await this.open();
    return new Promise((resolve) => {
      const tx = db.transaction('pdf_blobs', 'readonly');
      const req = tx.objectStore('pdf_blobs').get(docId);
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => resolve(null);
    });
  }

  /**
   * Sube un PDF a Supabase Storage y a la base de datos local
   */
  async uploadPdfFile(file, { folderId = null, title = '' }) {
    const arrayBuffer = await file.arrayBuffer();
    const docId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    let fileUrl = '';

    // 1. Guardar en Supabase Storage si está conectado
    if (this.supabase) {
      try {
        const { data: uploadData, error: uploadErr } = await this.supabase.storage
          .from('clases-pdf')
          .upload(fileName, file, { contentType: 'application/pdf', upsert: true });

        if (!uploadErr && uploadData) {
          const { data: pubUrl } = this.supabase.storage
            .from('clases-pdf')
            .getPublicUrl(fileName);
          fileUrl = pubUrl?.publicUrl || '';
        }
      } catch (e) {
        console.warn('Error subiendo a Supabase Storage (guardando local):', e);
      }
    }

    const docRecord = {
      id: docId,
      folder_id: folderId,
      title: title || file.name.replace(/\.pdf$/i, ''),
      file_name: file.name,
      file_size: file.size,
      file_url: fileUrl,
      page_count: 1,
      last_page: 1,
      created_at: new Date().toISOString()
    };

    // 2. Guardar metadata y blob en IndexedDB
    await this.saveLocal('documents', docRecord);
    await this.saveLocal('pdf_blobs', { id: docId, data: arrayBuffer });

    // 3. Guardar registro en Supabase Database
    if (this.supabase) {
      this.supabase.from('documents').upsert(docRecord).then();
    }

    return { ...docRecord, data: arrayBuffer };
  }

  async deleteDocument(id) {
    const db = await this.open();
    await new Promise((resolve) => {
      const tx = db.transaction(['documents', 'pdf_blobs'], 'readwrite');
      tx.objectStore('documents').delete(id);
      tx.objectStore('pdf_blobs').delete(id);
      tx.oncomplete = () => resolve();
    });

    if (this.supabase) {
      this.supabase.from('documents').delete().eq('id', id).then();
    }
  }

  // --- CARDS & FLASHCARDS ---
  async getCards(folderId = null) {
    const all = await this.getAllLocal('cards');
    return folderId ? all.filter(c => c.folder_id === folderId) : all;
  }

  async getDueCards(folderId = null) {
    const all = await this.getCards(folderId);
    const now = new Date();
    return all.filter(c => !c.proxima_revision || new Date(c.proxima_revision) <= now);
  }

  async saveCard(card) {
    const item = {
      ...card,
      id: card.id || 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      created_at: card.created_at || new Date().toISOString()
    };

    await this.saveLocal('cards', item);

    if (this.supabase) {
      this.supabase.from('cards').upsert(item).then();
    }
    return item;
  }

  async saveBatchCards(cardsArray) {
    const saved = [];
    for (const c of cardsArray) {
      const item = await this.saveCard(c);
      saved.push(item);
    }
    return saved;
  }

  async deleteCard(id) {
    const db = await this.open();
    await new Promise((resolve) => {
      const tx = db.transaction('cards', 'readwrite');
      tx.objectStore('cards').delete(id);
      tx.oncomplete = () => resolve();
    });

    if (this.supabase) {
      this.supabase.from('cards').delete().eq('id', id).then();
    }
  }

  // --- REVIEWS & LOGS ---
  async logReview(cardId, grade, responseTimeMs, isCorrect, srsUpdate) {
    const cards = await this.getCards();
    const card = cards.find(c => c.id === cardId);
    if (card) {
      Object.assign(card, srsUpdate);
      await this.saveCard(card);
    }

    const logEntry = {
      id: 'log_' + Date.now(),
      card_id: cardId,
      calificacion: grade,
      tiempo_respuesta_ms: responseTimeMs,
      acierto: isCorrect,
      reviewed_at: new Date().toISOString()
    };

    await this.saveLocal('reviews_log', logEntry);

    if (this.supabase) {
      this.supabase.from('reviews_log').insert(logEntry).then();
    }

    await this.registerStudyActivity(isCorrect);
  }

  async getMetrics() {
    const all = await this.getAllLocal('metrics');
    return all.find(m => m.id === 'user_default') || {
      id: 'user_default',
      racha_dias: 0,
      ultimo_estudio_fecha: null,
      meta_diaria: 20,
      total_repasos: 0,
      total_aciertos: 0
    };
  }

  async saveMetrics(metrics) {
    const item = { ...metrics, id: 'user_default' };
    await this.saveLocal('metrics', item);
    if (this.supabase) {
      this.supabase.from('user_metrics').upsert(item).then();
    }
  }

  async registerStudyActivity(isCorrect) {
    const metrics = await this.getMetrics();
    const todayStr = new Date().toISOString().split('T')[0];

    metrics.total_repasos = (metrics.total_repasos || 0) + 1;
    if (isCorrect) metrics.total_aciertos = (metrics.total_aciertos || 0) + 1;

    if (metrics.ultimo_estudio_fecha !== todayStr) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (metrics.ultimo_estudio_fecha === yesterday) {
        metrics.racha_dias = (metrics.racha_dias || 0) + 1;
      } else {
        metrics.racha_dias = 1;
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
