/**
 * PDF Viewer & Text Highlighter Module
 * Powered by PDF.js with interactive text selection, color highlighting, and AI integration
 */
class PDFViewerModule {
  constructor() {
    this.pdfDoc = null;
    this.pageNum = 1;
    this.pageRendering = false;
    this.pageNumPending = null;
    this.scale = 1.35;
    this.currentDocId = 'default_doc';
    this.currentDocName = 'Sin archivo cargado';
    this.activeColor = '#fef08a'; // Pastel yellow
    this.activeColorName = 'amarillo';
    this.lastSelectedText = '';
  }

  init() {
    this.setupPdfJs();
    this.bindEvents();
    this.renderHighlightsList();
  }

  setupPdfJs() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }

  bindEvents() {
    const fileInput = document.getElementById('pdf-file-input');
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && file.type === 'application/pdf') {
        this.loadPDFFile(file);
      } else if (file) {
        window.app.showToast('Por favor selecciona un archivo PDF válido.', 'warning');
      }
    });

    // Drag and drop zone
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
          this.loadPDFFile(file);
        }
      });
    }

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
        window.app.showToast(`Destacador color ${this.activeColorName} seleccionado`, 'info', 2000);
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

  loadPDFFile(file) {
    this.currentDocName = file.name;
    this.currentDocId = 'pdf_' + file.name.replace(/[^a-zA-Z0-9]/g, '_');
    const docTitleEl = document.getElementById('pdf-current-title');
    if (docTitleEl) docTitleEl.textContent = file.name;

    const fileReader = new FileReader();
    fileReader.onload = (e) => {
      const typedArray = new Uint8Array(e.target.result);
      this.loadPdfFromData(typedArray);
    };
    fileReader.readAsArrayBuffer(file);
  }

  async loadPdfFromData(data) {
    try {
      window.app.showToast('Cargando documento...', 'info');
      const loadingTask = window.pdfjsLib.getDocument({ data });
      this.pdfDoc = await loadingTask.promise;
      this.pageNum = 1;

      document.getElementById('pdf-page-count').textContent = this.pdfDoc.numPages;
      document.getElementById('pdf-dropzone').classList.add('hidden');
      document.getElementById('pdf-workspace').classList.remove('hidden');

      this.renderPage(this.pageNum);
      this.renderHighlightsList();
      window.app.showToast('Documento PDF cargado exitosamente.', 'success');
    } catch (e) {
      console.error('Error loading PDF', e);
      window.app.showToast('Error al procesar el archivo PDF: ' + e.message, 'danger');
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

      // Render Text Layer for text selection & highlighting
      const textContent = await page.getTextContent();
      const textLayerDiv = document.getElementById('pdf-text-layer');
      textLayerDiv.innerHTML = '';
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;

      // Set CSS variable for scale
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

      // Update indicators
      const pageNumInput = document.getElementById('pdf-page-num');
      if (pageNumInput) pageNumInput.value = num;

      // Re-apply existing highlights for this page
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
      docId: this.currentDocId,
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
    const overlay = document.getElementById('pdf-highlights-layer');
    if (!overlay) return;
    overlay.innerHTML = '';
    overlay.style.width = `${viewport.width}px`;
    overlay.style.height = `${viewport.height}px`;

    // Note: PDF.js text layer matches rendered text spans.
    // We add visual markers or styled highlight spans to the textLayerDiv
    const textLayer = document.getElementById('pdf-text-layer');
    if (!textLayer) return;

    const highlights = window.appStorage.getHighlights(this.currentDocId).filter(h => h.page === pageNum);
    if (highlights.length === 0) return;

    // Search and color text spans that match highlighted keywords
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
          <p>Selecciona cualquier texto en el PDF para destacarlo o enviarlo al Tutor IA.</p>
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
      window.app.showToast('Primero carga un archivo PDF.', 'warning');
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
      window.tutorModule.setContextDocument(`[Página ${this.pageNum} de ${this.currentDocName}]:\n${pageText}`);
      window.app.showToast(`Página ${this.pageNum} vinculada como contexto del Tutor IA`, 'success');
    } catch (e) {
      console.error(e);
      window.app.showToast('Error al extraer texto de la página: ' + e.message, 'danger');
    }
  }
}

window.pdfViewerModule = new PDFViewerModule();
