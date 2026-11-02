/**
 * PDF Viewer & Text Highlighter Module
 * Powered by PDF.js with IndexedDB Database for Class Storage & Annotations
 */
class PDFViewerModule {
  constructor() {
    this.pdfDoc = null;
    this.pageNum = 1;
    this.pageRendering = false;
    this.pageNumPending = null;
    this.scale = 1.35;
    this.currentDocId = null;
    this.currentDocName = 'Sin archivo cargado';
    this.activeColor = '#fef08a'; // Pastel yellow
    this.activeColorName = 'amarillo';
    this.lastSelectedText = '';
    this.currentSubject = 'General';
  }

  async init() {
    this.setupPdfJs();
    this.bindEvents();
    await this.renderLibrary();
    this.renderHighlightsList();
  }

  setupPdfJs() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }

  bindEvents() {
    // File inputs (both library upload and quick open)
    const fileInput = document.getElementById('pdf-file-input');
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && file.type === 'application/pdf') {
        this.promptAndSavePdf(file);
      } else if (file) {
        window.app.showToast('Por favor selecciona un archivo PDF válido.', 'warning');
      }
      fileInput.value = '';
    });

    const libraryUploadInput = document.getElementById('library-file-input');
    libraryUploadInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && file.type === 'application/pdf') {
        this.promptAndSavePdf(file);
      }
      libraryUploadInput.value = '';
    });

    // Drag and drop zone in library
    const dropZone = document.getElementById('pdf-dropzone');
    if (dropZone) {
      ['dragenter', 'dragover'].forEach(name => {
        dropZone.addEventListener(name, (e) => {
          e.preventDefault();
          dropZone.classList.add('drag-active');
        });
      });
      ['dragleave', 'drop'].forEach(name => {
        dropZone.addEventListener(name, (e) => {
          e.preventDefault();
          dropZone.classList.remove('drag-active');
        });
      });
      dropZone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
          this.promptAndSavePdf(file);
        }
      });
    }

    // Return to Library view button
    document.getElementById('btn-back-to-library')?.addEventListener('click', () => {
      this.showLibraryView();
    });

    // Search filter in library
    document.getElementById('library-search-input')?.addEventListener('input', (e) => {
      this.filterLibrary(e.target.value.trim().toLowerCase());
    });

    // Page controls
    document.getElementById('pdf-prev-page')?.addEventListener('click', () => this.onPrevPage());
    document.getElementById('pdf-next-page')?.addEventListener('click', () => this.onNextPage());
    document.getElementById('pdf-page-num')?.addEventListener('change', (e) => {
      const num = parseInt(e.target.value, 10);
      if (num >= 1 && num <= (this.pdfDoc?.numPages || 1)) {
        this.queueRenderPage(num);
      }
    });

    // Zoom controls
    document.getElementById('pdf-zoom-in')?.addEventListener('click', () => {
      this.scale = Math.min(this.scale + 0.2, 3.0);
      this.renderPage(this.pageNum);
    });
    document.getElementById('pdf-zoom-out')?.addEventListener('click', () => {
      this.scale = Math.max(this.scale - 0.2, 0.7);
      this.renderPage(this.pageNum);
    });
    document.getElementById('pdf-zoom-fit')?.addEventListener('click', () => {
      this.scale = 1.25;
      this.renderPage(this.pageNum);
    });

    // Color picker for highlighter
    document.querySelectorAll('.highlighter-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.highlighter-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeColor = btn.dataset.color;
        this.activeColorName = btn.dataset.name;
        window.app.showToast(`Destacador color ${this.activeColorName} seleccionado`, 'info', 1800);
      });
    });

    // Floating selection popup actions
    document.getElementById('btn-action-highlight')?.addEventListener('click', () => {
      this.highlightCurrentSelection();
    });

    document.getElementById('btn-action-ask-tutor')?.addEventListener('click', () => {
      this.sendSelectionToTutor();
    });

    document.getElementById('btn-action-make-flashcard')?.addEventListener('click', () => {
      this.sendSelectionToFlashcards();
    });

    document.getElementById('btn-action-make-quiz')?.addEventListener('click', () => {
      this.sendSelectionToQuiz();
    });

    // Text selection detection inside viewer
    const container = document.getElementById('pdf-page-container');
    container?.addEventListener('mouseup', () => this.handleTextSelection());
    document.addEventListener('mousedown', (e) => {
      const popup = document.getElementById('pdf-selection-popup');
      if (popup && !popup.contains(e.target) && !e.target.closest('#pdf-page-container')) {
        this.hideSelectionPopup();
      }
    });

    // Send page to tutor
    document.getElementById('btn-send-page-to-tutor')?.addEventListener('click', () => {
      this.extractCurrentPageTextAndSendToTutor();
    });
  }

  /**
   * Prompt user for subject and save PDF to IndexedDB
   */
  async promptAndSavePdf(file) {
    const defaultTitle = file.name.replace(/\.pdf$/i, '');
    const subject = prompt('¿A qué asignatura o materia corresponde esta clase? (Ej: Cardiología, Fisiología, Historia...)', 'General') || 'General';
    const title = prompt('Título descriptivo de la clase:', defaultTitle) || defaultTitle;

    try {
      window.app.showToast('Guardando clase en tu base de datos local...', 'info');
      const record = await window.dbService.savePDF(file, { subject, title });
      window.app.showToast(`Clase "${record.title}" guardada en la base de datos.`, 'success');
      await this.renderLibrary();
      await this.openPdfFromDatabase(record.id);
    } catch (e) {
      console.error(e);
      window.app.showToast('Error al guardar en la base de datos: ' + e.message, 'danger');
    }
  }

  /**
   * Render the library list of stored classes
   */
  async renderLibrary() {
    const grid = document.getElementById('library-classes-grid');
    const badge = document.getElementById('library-stats-badge');
    if (!grid) return;

    try {
      const list = await window.dbService.getAllPDFs();
      const storage = await window.dbService.getStorageEstimate();

      if (badge) {
        badge.innerHTML = `📚 ${list.length} Clases Guardadas • Espacio usado: <strong>${storage.usage}</strong>`;
      }

      if (list.length === 0) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <span class="empty-icon">📂</span>
            <h3>Tu biblioteca de clases está vacía</h3>
            <p>Sube tus archivos PDF aquí. Quedarán almacenados permanentemente en tu navegador para abrirlos cuando quieras.</p>
            <button class="btn btn-primary" onclick="document.getElementById('library-file-input').click()">
              + Subir mi primera clase en PDF
            </button>
          </div>
        `;
        return;
      }

      const allHighlights = window.appStorage.getHighlights();

      grid.innerHTML = list.map(item => {
        const highlightsCount = allHighlights.filter(h => h.docId === item.id).length;
        const uploadDateFormatted = new Date(item.uploadDate).toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });

        return `
          <div class="class-card">
            <div class="class-card-header">
              <span class="badge badge-indigo">${item.subject}</span>
              <button class="icon-btn-danger" title="Eliminar clase de la base de datos" onclick="window.pdfViewerModule.deleteClassFromDb('${item.id}', '${item.title}')">
                🗑️
              </button>
            </div>
            <h3 class="class-card-title" title="${item.title}">${item.title}</h3>
            
            <div class="class-card-meta">
              <span>📄 ${item.formattedSize}</span>
              <span>📅 ${uploadDateFormatted}</span>
              ${item.lastPage > 1 ? `<span>🔖 Pág. ${item.lastPage}</span>` : ''}
              ${highlightsCount > 0 ? `<span>🖍️ ${highlightsCount} destacados</span>` : ''}
            </div>

            <div class="class-card-footer">
              <button class="btn btn-primary w-full" onclick="window.pdfViewerModule.openPdfFromDatabase('${item.id}')">
                📖 Abrir y Estudiar
              </button>
            </div>
          </div>
        `;
      }).join('');

    } catch (e) {
      console.error('Error rendering library', e);
    }
  }

  filterLibrary(query) {
    const cards = document.querySelectorAll('.class-card');
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(query) ? '' : 'none';
    });
  }

  async openPdfFromDatabase(id) {
    try {
      window.app.showToast('Cargando clase desde la base de datos...', 'info');
      const record = await window.dbService.getPDF(id);
      if (!record || !record.data) {
        throw new Error('Archivo no encontrado');
      }

      this.currentDocId = record.id;
      this.currentDocName = record.title;
      this.currentSubject = record.subject;

      // Update UI title
      const titleEl = document.getElementById('pdf-current-title');
      const subjectTag = document.getElementById('pdf-current-subject-tag');
      if (titleEl) titleEl.textContent = record.title;
      if (subjectTag) {
        subjectTag.textContent = record.subject;
        subjectTag.className = 'badge badge-indigo';
      }

      // Hide library view, show PDF workspace view
      document.getElementById('pdf-library-view').classList.add('hidden');
      document.getElementById('pdf-workspace').classList.remove('hidden');

      // Load with PDF.js
      const typedArray = new Uint8Array(record.data);
      const loadingTask = window.pdfjsLib.getDocument({ data: typedArray });
      this.pdfDoc = await loadingTask.promise;

      // Save total pages
      if (!record.totalPageCount || record.totalPageCount !== this.pdfDoc.numPages) {
        window.dbService.updatePDF(id, { totalPageCount: this.pdfDoc.numPages });
      }

      document.getElementById('pdf-page-count').textContent = this.pdfDoc.numPages;

      // Restore last read page if available
      this.pageNum = record.lastPage && record.lastPage <= this.pdfDoc.numPages ? record.lastPage : 1;

      this.renderPage(this.pageNum);
      this.renderHighlightsList();
      window.app.showToast(`Clase "${record.title}" lista para estudio.`, 'success');

    } catch (e) {
      console.error(e);
      window.app.showToast('Error al abrir documento: ' + e.message, 'danger');
    }
  }

  showLibraryView() {
    document.getElementById('pdf-workspace').classList.add('hidden');
    document.getElementById('pdf-library-view').classList.remove('hidden');
    this.renderLibrary();
  }

  async deleteClassFromDb(id, title) {
    if (confirm(`¿Deseas eliminar definitivamente "${title}" de tu base de datos?`)) {
      await window.dbService.deletePDF(id);
      window.app.showToast('Clase eliminada de la base de datos.', 'info');
      await this.renderLibrary();
    }
  }

  async renderPage(num) {
    if (!this.pdfDoc) return;
    this.pageRendering = true;

    try {
      const page = await this.pdfDoc.getPage(num);
      const canvas = document.getElementById('pdf-canvas');
      const ctx = canvas.getContext('2d');
      const viewport = page.getViewport({ scale: this.scale });

      // Support HiDPI screens
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = Math.floor(viewport.width) + 'px';
      canvas.style.height = Math.floor(viewport.height) + 'px';

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

      const renderContext = {
        canvasContext: ctx,
        transform: transform,
        viewport: viewport
      };

      const renderTask = page.render(renderContext);
      await renderTask.promise;

      // Render Text Layer
      const textContent = await page.getTextContent();
      const textLayerDiv = document.getElementById('pdf-text-layer');
      textLayerDiv.innerHTML = '';
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;
      textLayerDiv.style.setProperty('--scale-factor', this.scale);

      if (window.pdfjsLib.renderTextLayer) {
        window.pdfjsLib.renderTextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport: viewport,
          textDivs: []
        });
      }

      this.pageRendering = false;
      if (this.pageNumPending !== null) {
        this.renderPage(this.pageNumPending);
        this.pageNumPending = null;
      }

      // Update input
      const pageNumInput = document.getElementById('pdf-page-num');
      if (pageNumInput) pageNumInput.value = num;

      // Save progress to database
      if (this.currentDocId) {
        window.dbService.updatePDF(this.currentDocId, { lastPage: num, lastOpened: new Date().toISOString() });
      }

      // Re-apply highlights
      this.renderPageHighlightsOverlay(num, viewport);

    } catch (e) {
      console.error('Render page error', e);
      this.pageRendering = false;
    }
  }

  queueRenderPage(num) {
    if (this.pageRendering) {
      this.pageNumPending = num;
    } else {
      this.pageNum = num;
      this.renderPage(num);
    }
  }

  onPrevPage() {
    if (this.pageNum <= 1) return;
    this.pageNum--;
    this.queueRenderPage(this.pageNum);
  }

  onNextPage() {
    if (!this.pdfDoc || this.pageNum >= this.pdfDoc.numPages) return;
    this.pageNum++;
    this.queueRenderPage(this.pageNum);
  }

  handleTextSelection() {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (!text || text.length < 2) {
      this.hideSelectionPopup();
      return;
    }

    this.lastSelectedText = text;

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const popup = document.getElementById('pdf-selection-popup');
      if (popup) {
        popup.style.top = `${window.scrollY + rect.top - 46}px`;
        popup.style.left = `${window.scrollX + rect.left + (rect.width / 2)}px`;
        popup.classList.add('active');
      }
    } catch (e) {
      this.hideSelectionPopup();
    }
  }

  hideSelectionPopup() {
    const popup = document.getElementById('pdf-selection-popup');
    if (popup) popup.classList.remove('active');
  }

  highlightCurrentSelection() {
    const text = this.lastSelectedText;
    if (!text) return;

    const highlight = {
      id: 'hl_' + Date.now(),
      docId: this.currentDocId || 'general_doc',
      docName: this.currentDocName,
      page: this.pageNum,
      text: text,
      color: this.activeColor,
      colorName: this.activeColorName,
      createdAt: new Date().toISOString()
    };

    window.appStorage.addHighlight(highlight);
    this.hideSelectionPopup();
    window.getSelection()?.removeAllRanges();
    this.renderHighlightsList();
    this.renderPage(this.pageNum);
    window.app.showToast('Texto destacado guardado en tus apuntes.', 'success');
  }

  renderPageHighlightsOverlay(pageNum, viewport) {
    const textLayer = document.getElementById('pdf-text-layer');
    if (!textLayer) return;

    const highlights = window.appStorage.getHighlights(this.currentDocId).filter(h => h.page === pageNum);
    if (highlights.length === 0) return;

    highlights.forEach(h => {
      const snippet = h.text.slice(0, 30).toLowerCase();
      const spans = textLayer.querySelectorAll('span');
      spans.forEach(span => {
        if (span.textContent.toLowerCase().includes(snippet) || (snippet.length > 10 && snippet.includes(span.textContent.trim().toLowerCase()) && span.textContent.trim().length > 3)) {
          span.style.backgroundColor = h.color;
          span.style.borderRadius = '3px';
          span.style.padding = '1px 2px';
        }
      });
    });
  }

  renderHighlightsList() {
    const container = document.getElementById('pdf-highlights-container');
    const badge = document.getElementById('pdf-highlights-count');
    if (!container) return;

    const highlights = window.appStorage.getHighlights(this.currentDocId);
    if (badge) badge.textContent = highlights.length;

    if (highlights.length === 0) {
      container.innerHTML = `
        <div class="empty-state-mini">
          <span class="empty-icon">🖍️</span>
          <p>Selecciona texto en el PDF para destacarlo o enviarlo al Tutor IA.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = highlights.map(h => `
      <div class="highlight-item" style="border-left-color: ${h.color};">
        <div class="highlight-item-header">
          <span class="badge badge-gray text-xs">Pág. ${h.page}</span>
          <button class="icon-btn-danger text-xs" title="Borrar destacado" onclick="window.pdfViewerModule.deleteHighlight('${h.id}')">🗑️</button>
        </div>
        <p class="highlight-item-text" onclick="window.pdfViewerModule.jumpToPage(${h.page})" title="Clic para ir a la página">
          "${h.text.length > 120 ? h.text.slice(0, 120) + '...' : h.text}"
        </p>
        <div class="highlight-item-actions">
          <button class="btn-text-action" onclick="window.pdfViewerModule.sendTextToTutor(${JSON.stringify(h.text)})">
            🤖 Preguntar
          </button>
          <button class="btn-text-action" onclick="window.pdfViewerModule.sendTextToFlashcard(${JSON.stringify(h.text)})">
            🗂️ Flashcard
          </button>
        </div>
      </div>
    `).join('');
  }

  jumpToPage(page) {
    if (this.pdfDoc && page >= 1 && page <= this.pdfDoc.numPages) {
      this.queueRenderPage(page);
    }
  }

  deleteHighlight(id) {
    window.appStorage.deleteHighlight(id);
    this.renderHighlightsList();
    this.renderPage(this.pageNum);
    window.app.showToast('Destacado eliminado.', 'info');
  }

  sendSelectionToTutor() {
    const text = this.lastSelectedText;
    this.hideSelectionPopup();
    this.sendTextToTutor(text);
  }

  sendTextToTutor(text) {
    window.app.switchTab('tutor');
    window.tutorModule.injectContextAndPrompt(`Sobre este fragmento del PDF:\n"${text}"\n\n¿Podrías explicármelo en detalle y darme un ejemplo práctico?`);
  }

  sendSelectionToFlashcards() {
    const text = this.lastSelectedText;
    this.hideSelectionPopup();
    this.sendTextToFlashcard(text);
  }

  sendTextToFlashcard(text) {
    window.app.switchTab('flashcards');
    window.flashcardsModule.openCreateModalWithText(text);
  }

  sendSelectionToQuiz() {
    const text = this.lastSelectedText;
    this.hideSelectionPopup();
    window.app.switchTab('quiz');
    window.quizModule.openCreateModalWithText(text);
  }

  async extractCurrentPageTextAndSendToTutor() {
    if (!this.pdfDoc) {
      window.app.showToast('Primero abre un documento.', 'warning');
      return;
    }

    try {
      window.app.showToast('Extrayendo texto de la página actual...', 'info');
      const page = await this.pdfDoc.getPage(this.pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');

      if (!pageText.trim()) {
        window.app.showToast('No se detectó texto seleccionable en esta página (podría ser una imagen escaneada).', 'warning');
        return;
      }

      window.app.switchTab('tutor');
      window.tutorModule.setContextDocument(`[Página ${this.pageNum} de "${this.currentDocName}"]:
${pageText}`);
      window.app.showToast(`Página ${this.pageNum} vinculada al Tutor IA`, 'success');
    } catch (e) {
      console.error(e);
      window.app.showToast('Error al extraer texto: ' + e.message, 'danger');
    }
  }
}

window.pdfViewerModule = new PDFViewerModule();
