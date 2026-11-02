/**
 * PDF Management, Cloud Storage & Interactive Highlighter Module
 */
import { db } from './db.js';

export class PDFModule {
  constructor(containerElement, onGenerateFromPdfCallback) {
    this.container = containerElement;
    this.onGenerateFromPdfCallback = onGenerateFromPdfCallback;
    this.currentDoc = null;
    this.pdfInstance = null;
    this.pageNum = 1;
    this.scale = 1.35;
    this.isRendering = false;
    this.activeColor = '#fef08a';
    this.selectedFolderFilter = 'all';
  }

  async render() {
    const folders = await db.getFolders();
    const docs = await db.getDocuments(this.selectedFolderFilter === 'all' ? null : this.selectedFolderFilter);

    this.container.innerHTML = `
      <div class="space-y-6">
        
        <!-- Header & Action Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
          <div>
            <h2 class="text-xl font-bold text-slate-100 flex items-center gap-2.5">
              <span>📖</span> Biblioteca de Clases & PDFs
            </h2>
            <p class="text-xs text-slate-400 mt-1">Sube tus clases, léelas con destacador y genera bancos de preguntas automáticos con Gemini.</p>
          </div>

          <div class="flex items-center gap-3">
            <button id="btn-open-upload-modal" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition flex items-center gap-2">
              <span>+</span>
              <span>Subir Clase (PDF)</span>
            </button>
          </div>
        </div>

        <!-- Filter by Folder Pills -->
        <div class="flex items-center gap-2 overflow-x-auto pb-2 text-xs font-bold">
          <button data-folder-filter="all" class="filter-pill px-3.5 py-1.5 rounded-xl border ${this.selectedFolderFilter === 'all' ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40' : 'bg-slate-800/80 text-slate-400 border-slate-700/60'} transition">
            Todas las asignaturas
          </button>
          ${folders.map(f => `
            <button data-folder-filter="${f.id}" class="filter-pill px-3.5 py-1.5 rounded-xl border ${this.selectedFolderFilter === f.id ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40' : 'bg-slate-800/80 text-slate-400 border-slate-700/60'} transition flex items-center gap-1.5">
              <span>${f.icon}</span>
              <span>${f.title}</span>
            </button>
          `).join('')}
        </div>

        <!-- Documents Grid -->
        <div id="pdf-docs-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${docs.length === 0 ? `
            <div class="col-span-full text-center py-16 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
              <span class="text-4xl block mb-2">📄</span>
              <h3 class="text-base font-bold text-slate-200 mb-1">No hay clases guardadas en esta sección</h3>
              <p class="text-xs text-slate-400 mb-4">Sube diapositivas o guías en PDF. Se guardarán en Supabase Storage y estarán disponibles sin conexión.</p>
              <button onclick="document.getElementById('btn-open-upload-modal').click()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold">
                + Subir mi primer PDF
              </button>
            </div>
          ` : docs.map(doc => {
            const folder = folders.find(f => f.id === doc.folder_id);
            const sizeMb = (doc.file_size / (1024 * 1024)).toFixed(1);
            return `
              <div class="bg-slate-800/80 border border-slate-700/80 hover:border-indigo-500/50 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all hover:-translate-y-1 group">
                <div>
                  <div class="flex items-center justify-between gap-2 mb-3">
                    <span class="px-2.5 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                      ${folder ? `${folder.icon} ${folder.title}` : 'General'}
                    </span>
                    <button data-delete-doc="${doc.id}" class="text-slate-500 hover:text-rose-400 text-xs p-1" title="Eliminar documento">🗑️</button>
                  </div>
                  <h4 class="text-base font-bold text-slate-100 mb-1 leading-snug group-hover:text-indigo-300 transition line-clamp-2" title="${doc.title}">
                    ${doc.title}
                  </h4>
                  <div class="text-[11px] text-slate-400 space-y-0.5 mb-4">
                    <p>📄 ${doc.file_name} • ${sizeMb} MB</p>
                    <p>📅 ${new Date(doc.created_at).toLocaleDateString('es-ES')}</p>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2 pt-3 border-t border-slate-700/60">
                  <button data-open-reader="${doc.id}" class="py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition text-center">
                    📖 Leer / Estudiar
                  </button>
                  <button data-gen-from-doc="${doc.id}" class="py-2 px-3 bg-slate-700/70 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition text-center" title="Crear banco de preguntas de este PDF con Gemini">
                    ✨ Quiz IA
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Embedded Reader Modal / Container (hidden by default) -->
        <div id="pdf-reader-modal" class="fixed inset-0 z-50 bg-slate-950/95 flex flex-col hidden animate-fadeIn">
          
          <!-- Reader Toolbar -->
          <div class="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-3">
              <button id="btn-close-reader" class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold">
                ✕ Salir
              </button>
              <span id="reader-doc-title" class="text-sm font-bold text-slate-100 truncate max-w-xs md:max-w-md"></span>
            </div>

            <!-- Page & Zoom Controls -->
            <div class="flex items-center gap-2">
              <button id="reader-prev-page" class="p-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold">◀</button>
              <span class="text-xs font-semibold text-slate-300">
                Pág. <span id="reader-page-current">1</span> / <span id="reader-page-total">1</span>
              </span>
              <button id="reader-next-page" class="p-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold">▶</button>
              <div class="h-4 w-[1px] bg-slate-700 mx-1"></div>
              <button id="reader-zoom-out" class="p-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs">🔍−</button>
              <button id="reader-zoom-in" class="p-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs">🔍+</button>
            </div>

            <!-- AI Action Button -->
            <div>
              <button id="btn-reader-generate-ai" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5">
                <span>✨</span>
                <span class="hidden sm:inline">Generar Quiz de esta Página</span>
              </button>
            </div>
          </div>

          <!-- Reader Canvas Viewport -->
          <div class="flex-1 overflow-auto p-4 flex justify-center bg-slate-950" id="reader-viewport">
            <div class="relative shadow-2xl bg-white rounded">
              <canvas id="reader-canvas" class="block"></canvas>
            </div>
          </div>
        </div>

        <!-- Upload PDF Modal -->
        <div id="modal-upload-pdf" class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 hidden">
          <div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-base font-bold text-slate-100">Subir Nueva Clase en PDF</h3>
              <button id="btn-close-upload-modal" class="text-slate-400 hover:text-white">&times;</button>
            </div>
            <form id="form-upload-pdf" class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase mb-1.5">Asignatura de Destino *</label>
                <select id="upload-folder-select" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500">
                  ${folders.map(f => `<option value="${f.id}">${f.icon} ${f.title}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase mb-1.5">Título de la Clase *</label>
                <input type="text" id="upload-doc-title" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500" placeholder="Ej: Clase 04 - Arritmias y Fármacos" required>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase mb-1.5">Archivo PDF *</label>
                <input type="file" id="upload-file-input" accept="application/pdf" class="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500" required>
              </div>
              <div class="flex justify-end gap-2 pt-2">
                <button type="button" id="btn-cancel-upload" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white">Cancelar</button>
                <button type="submit" id="btn-submit-upload" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md">
                  Subir y Guardar
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Filter pills
    this.container.querySelectorAll('[data-folder-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedFolderFilter = btn.dataset.folderFilter;
        this.render();
      });
    });

    // Upload Modal toggle
    const uploadModal = this.container.querySelector('#modal-upload-pdf');
    this.container.querySelector('#btn-open-upload-modal')?.addEventListener('click', () => {
      uploadModal.classList.remove('hidden');
    });
    this.container.querySelector('#btn-close-upload-modal')?.addEventListener('click', () => {
      uploadModal.classList.add('hidden');
    });
    this.container.querySelector('#btn-cancel-upload')?.addEventListener('click', () => {
      uploadModal.classList.add('hidden');
    });

    // Handle Upload
    const formUpload = this.container.querySelector('#form-upload-pdf');
    formUpload?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = this.container.querySelector('#upload-file-input');
      const file = fileInput.files[0];
      const title = this.container.querySelector('#upload-doc-title').value.trim();
      const folderId = this.container.querySelector('#upload-folder-select').value;
      const btnSubmit = this.container.querySelector('#btn-submit-upload');

      if (!file) return;

      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Subiendo a Supabase...';

      try {
        await db.uploadPdfFile(file, { folderId, title });
        uploadModal.classList.add('hidden');
        formUpload.reset();
        await this.render();
      } catch (err) {
        alert('Error al subir PDF: ' + err.message);
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Subir y Guardar';
      }
    });

    // Open Reader
    this.container.querySelectorAll('[data-open-reader]').forEach(btn => {
      btn.addEventListener('click', () => {
        const docId = btn.dataset.openReader;
        this.openReader(docId);
      });
    });

    // Generate from doc button in card
    this.container.querySelectorAll('[data-gen-from-doc]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const docId = btn.dataset.genFromDoc;
        await this.extractAndTriggerGenerator(docId);
      });
    });

    // Delete doc
    this.container.querySelectorAll('[data-delete-doc]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const docId = btn.dataset.deleteDoc;
        if (confirm('¿Deseas eliminar este documento PDF?')) {
          await db.deleteDocument(docId);
          await this.render();
        }
      });
    });

    // Reader modal controls
    this.container.querySelector('#btn-close-reader')?.addEventListener('click', () => {
      this.container.querySelector('#pdf-reader-modal').classList.add('hidden');
      this.pdfInstance = null;
    });

    this.container.querySelector('#reader-prev-page')?.addEventListener('click', () => {
      if (this.pageNum <= 1) return;
      this.pageNum--;
      this.renderCurrentPdfPage();
    });

    this.container.querySelector('#reader-next-page')?.addEventListener('click', () => {
      if (!this.pdfInstance || this.pageNum >= this.pdfInstance.numPages) return;
      this.pageNum++;
      this.renderCurrentPdfPage();
    });

    this.container.querySelector('#reader-zoom-in')?.addEventListener('click', () => {
      this.scale = Math.min(this.scale + 0.2, 2.5);
      this.renderCurrentPdfPage();
    });

    this.container.querySelector('#reader-zoom-out')?.addEventListener('click', () => {
      this.scale = Math.max(this.scale - 0.2, 0.8);
      this.renderCurrentPdfPage();
    });

    this.container.querySelector('#btn-reader-generate-ai')?.addEventListener('click', async () => {
      if (!this.pdfInstance) return;
      const page = await this.pdfInstance.getPage(this.pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');

      if (this.onGenerateFromPdfCallback) {
        this.container.querySelector('#pdf-reader-modal').classList.add('hidden');
        this.onGenerateFromPdfCallback(pageText, this.currentDoc?.folder_id);
      }
    });
  }

  async openReader(docId) {
    const docs = await db.getDocuments();
    const doc = docs.find(d => d.id === docId);
    if (!doc) return;

    this.currentDoc = doc;
    const arrayBuffer = await db.getPdfData(docId);
    if (!arrayBuffer) {
      alert('El archivo no está disponible en la memoria local.');
      return;
    }

    const modal = this.container.querySelector('#pdf-reader-modal');
    this.container.querySelector('#reader-doc-title').textContent = doc.title;
    modal.classList.remove('hidden');

    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      this.pdfInstance = await loadingTask.promise;
      this.pageNum = 1;
      this.container.querySelector('#reader-page-total').textContent = this.pdfInstance.numPages;
      this.renderCurrentPdfPage();
    }
  }

  async renderCurrentPdfPage() {
    if (!this.pdfInstance || this.isRendering) return;
    this.isRendering = true;

    const page = await this.pdfInstance.getPage(this.pageNum);
    const canvas = this.container.querySelector('#reader-canvas');
    const ctx = canvas.getContext('2d');
    const viewport = page.getViewport({ scale: this.scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    this.container.querySelector('#reader-page-current').textContent = this.pageNum;

    await page.render({ canvasContext: ctx, viewport }).promise;
    this.isRendering = false;
  }

  async extractAndTriggerGenerator(docId) {
    const docs = await db.getDocuments();
    const doc = docs.find(d => d.id === docId);
    const arrayBuffer = await db.getPdfData(docId);
    if (!doc || !arrayBuffer) return;

    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      
      // Extraer texto de las primeras páginas
      let combinedText = '';
      const pagesToExtract = Math.min(pdf.numPages, 3);
      for (let p = 1; p <= pagesToExtract; p++) {
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();
        combinedText += textContent.items.map(item => item.str).join(' ') + '\n\n';
      }

      if (this.onGenerateFromPdfCallback) {
        this.onGenerateFromPdfCallback(combinedText, doc.folder_id);
      }
    }
  }
}
