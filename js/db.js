/**
 * IndexedDB Database Service - Persistent Local Storage for PDF Files & Classes
 * Allows storing large PDF files (megabytes/gigabytes) locally in the browser with full persistence.
 */
class DatabaseService {
  constructor() {
    this.dbName = 'FlojerApp_Database';
    this.version = 1;
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('pdf_library')) {
          const store = db.createObjectStore('pdf_library', { keyPath: 'id' });
          store.createIndex('uploadDate', 'uploadDate', { unique: false });
          store.createIndex('subject', 'subject', { unique: false });
          store.createIndex('title', 'title', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Save a PDF file with metadata to IndexedDB
   */
  async savePDF(file, { subject = 'General', title = '' } = {}) {
    const db = await this.open();
    const arrayBuffer = await file.arrayBuffer();

    const id = 'pdf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const docTitle = title || file.name.replace(/\.pdf$/i, '');

    const record = {
      id,
      title: docTitle,
      fileName: file.name,
      fileSize: file.size,
      formattedSize: this.formatBytes(file.size),
      subject: subject || 'General',
      uploadDate: new Date().toISOString(),
      lastOpened: new Date().toISOString(),
      lastPage: 1,
      totalPageCount: null,
      data: arrayBuffer
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('pdf_library', 'readwrite');
      const store = tx.objectStore('pdf_library');
      const req = store.add(record);

      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get all stored PDF classes without transferring the heavy binary payload
   */
  async getAllPDFs() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pdf_library', 'readonly');
      const store = tx.objectStore('pdf_library');
      const req = store.openCursor();
      const list = [];

      req.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const val = cursor.value;
          // Exclude large binary data from the listing for maximum UI speed
          list.push({
            id: val.id,
            title: val.title,
            fileName: val.fileName,
            fileSize: val.fileSize,
            formattedSize: val.formattedSize,
            subject: val.subject,
            uploadDate: val.uploadDate,
            lastOpened: val.lastOpened,
            lastPage: val.lastPage,
            totalPageCount: val.totalPageCount
          });
          cursor.continue();
        } else {
          // Sort by uploadDate descending
          list.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
          resolve(list);
        }
      };

      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Fetch a single PDF including its binary ArrayBuffer for rendering
   */
  async getPDF(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pdf_library', 'readonly');
      const store = tx.objectStore('pdf_library');
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Update metadata (e.g. last read page, total pages, title, subject)
   */
  async updatePDF(id, updates = {}) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pdf_library', 'readwrite');
      const store = tx.objectStore('pdf_library');
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const record = getReq.result;
        if (!record) {
          reject(new Error('Documento no encontrado'));
          return;
        }

        Object.assign(record, updates);
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve(record);
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  /**
   * Delete a PDF from the database
   */
  async deletePDF(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pdf_library', 'readwrite');
      const store = tx.objectStore('pdf_library');
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Calculate storage space used
   */
  async getStorageEstimate() {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: this.formatBytes(estimate.usage || 0),
        quota: this.formatBytes(estimate.quota || 0),
        rawUsage: estimate.usage
      };
    }
    return { usage: 'Desconocido', quota: 'Desconocido', rawUsage: 0 };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

window.dbService = new DatabaseService();
