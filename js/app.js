/**
 * FlojerApp - Main Application Controller & Dashboard
 */
import { db } from './db.js';
import { QuizEngine } from './quiz.js';
import { FlashcardEngine } from './study.js';
import { GeneratorModule } from './generator.js';
import { PDFModule } from './pdf.js';

class AppController {
  constructor() {
    this.currentView = 'dashboard';
    this.quizEngine = null;
    this.flashcardEngine = null;
    this.generatorModule = null;
    this.pdfModule = null;
  }

  async init() {
    this.bindGlobalNavigation();
    this.bindModals();
    this.registerServiceWorker();
    await this.renderDashboard();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
          console.log('FlojerApp Service Worker registrado con éxito:', reg.scope);
        }).catch(err => {
          console.warn('Error registrando Service Worker:', err);
        });
      });
    }
  }

  bindGlobalNavigation() {
    // Nav items
    document.querySelectorAll('.app-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.switchView(view);
      });
    });

    // Logo click goes to dashboard
    document.getElementById('brand-home')?.addEventListener('click', () => {
      this.switchView('dashboard');
    });

    // Settings button
    document.getElementById('btn-open-settings')?.addEventListener('click', () => {
      this.openSettingsModal();
    });

    // New folder button
    document.getElementById('btn-new-folder')?.addEventListener('click', () => {
      this.openNewFolderModal();
    });
  }

  switchView(viewName, params = {}) {
    this.currentView = viewName;

    // Toggle active nav styling
    document.querySelectorAll('.app-nav-btn').forEach(btn => {
      btn.classList.toggle('bg-indigo-600/20', btn.dataset.view === viewName);
      btn.classList.toggle('text-indigo-400', btn.dataset.view === viewName);
      btn.classList.toggle('border-indigo-500/30', btn.dataset.view === viewName);
    });

    // Hide all view containers
    document.querySelectorAll('.view-container').forEach(el => el.classList.add('hidden'));

    const targetEl = document.getElementById(`view-${viewName}`);
    if (targetEl) targetEl.classList.remove('hidden');

    if (viewName === 'dashboard') {
      this.renderDashboard();
    } else if (viewName === 'pdf') {
      this.renderPdfView();
    } else if (viewName === 'generator') {
      this.renderGenerator(params.prefill);
    } else if (viewName === 'quiz') {
      this.startQuizView(params.cards);
    } else if (viewName === 'study') {
      this.startStudyView(params.cards);
    }
  }

  async renderDashboard() {
    const folders = await db.getFolders();
    const allCards = await db.getCards();
    const dueCards = await db.getDueCards();
    const metrics = await db.getMetrics();
    const allDocs = await db.getDocuments();

    // Render Metrics & Daily Goals
    const streakEl = document.getElementById('dash-streak-count');
    const goalTextEl = document.getElementById('dash-goal-text');
    const goalFillEl = document.getElementById('dash-goal-fill');
    const dueCountEl = document.getElementById('dash-due-count');
    const totalCountEl = document.getElementById('dash-total-count');

    if (streakEl) streakEl.textContent = `${metrics.racha_dias || 0} días`;

    const dailyGoal = metrics.meta_diaria || 20;
    const todayReviewed = Math.min(metrics.total_repasos || 0, dailyGoal);
    const goalPct = Math.min(Math.round((todayReviewed / dailyGoal) * 100), 100);

    if (goalTextEl) goalTextEl.textContent = `${todayReviewed} / ${dailyGoal} tarjetas repasadas`;
    if (goalFillEl) goalFillEl.style.width = `${goalPct}%`;
    if (dueCountEl) dueCountEl.textContent = dueCards.length;
    if (totalCountEl) totalCountEl.textContent = allCards.length;

    // Quick Start Button
    const btnQuickStart = document.getElementById('btn-quick-start');
    if (btnQuickStart) {
      btnQuickStart.disabled = dueCards.length === 0;
      btnQuickStart.innerHTML = dueCards.length > 0 
        ? `🚀 Continuar Estudio (${dueCards.length} vencidas)` 
        : `✅ Todo al día por hoy`;
      
      btnQuickStart.onclick = () => {
        if (dueCards.length > 0) {
          this.switchView('quiz', { cards: dueCards });
        }
      };
    }

    // Render Folders Grid
    const foldersContainer = document.getElementById('dash-folders-grid');
    if (!foldersContainer) return;

    if (folders.length === 0) {
      foldersContainer.innerHTML = `
        <div class="col-span-full text-center py-12 border border-dashed border-slate-700 rounded-2xl bg-slate-800/40">
          <span class="text-4xl block mb-2">📁</span>
          <p class="text-slate-300 font-semibold mb-3">Aún no tienes asignaturas creadas</p>
          <button id="btn-empty-new-folder" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition">
            + Crear Asignatura
          </button>
        </div>
      `;
      foldersContainer.querySelector('#btn-empty-new-folder')?.addEventListener('click', () => this.openNewFolderModal());
      return;
    }

    foldersContainer.innerHTML = folders.map(folder => {
      const folderCards = allCards.filter(c => c.folder_id === folder.id);
      const folderDue = dueCards.filter(c => c.folder_id === folder.id);
      const folderDocs = allDocs.filter(d => d.folder_id === folder.id);
      const mastered = folderCards.filter(c => c.estado === 'mastered').length;

      return `
        <div class="bg-slate-800/80 border border-slate-700/80 hover:border-indigo-500/50 rounded-2xl p-5 shadow-lg transition-all hover:-translate-y-1 group">
          <div class="flex items-center justify-between mb-3">
            <span class="text-2xl p-2 rounded-xl bg-slate-900 border border-slate-700/60">${folder.icon || '📁'}</span>
            <div class="flex items-center gap-1">
              ${folderDue.length > 0 ? `<span class="px-2 py-0.5 text-[11px] font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">${folderDue.length} pendientes</span>` : ''}
              <button data-folder-delete="${folder.id}" class="text-slate-500 hover:text-rose-400 p-1 transition" title="Eliminar asignatura">🗑️</button>
            </div>
          </div>

          <h3 class="text-base font-bold text-slate-100 mb-1 group-hover:text-indigo-300 transition">${folder.title}</h3>
          <p class="text-xs text-slate-400 mb-4 line-clamp-2">${folder.description || 'Sin descripción'}</p>

          <div class="flex items-center justify-between text-xs text-slate-400 pb-3 mb-3 border-b border-slate-700/50">
            <span>${folderCards.length} preguntas (${mastered} dominadas)</span>
            <span>📄 ${folderDocs.length} PDFs</span>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button data-folder-quiz="${folder.id}" class="py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition text-center">
              📝 Quiz (${folderDue.length || folderCards.length})
            </button>
            <button data-folder-study="${folder.id}" class="py-2 px-3 bg-slate-700/70 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition text-center">
              🗂️ Flashcards
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Bind Folder Buttons
    foldersContainer.querySelectorAll('[data-folder-quiz]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fId = btn.dataset.folderQuiz;
        const due = await db.getDueCards(fId);
        const all = await db.getCards(fId);
        this.switchView('quiz', { cards: due.length > 0 ? due : all });
      });
    });

    foldersContainer.querySelectorAll('[data-folder-study]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fId = btn.dataset.folderStudy;
        const all = await db.getCards(fId);
        this.switchView('study', { cards: all });
      });
    });

    foldersContainer.querySelectorAll('[data-folder-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fId = btn.dataset.folderDelete;
        if (confirm('¿Deseas eliminar esta asignatura, sus documentos y preguntas?')) {
          await db.deleteFolder(fId);
          await this.renderDashboard();
        }
      });
    });
  }

  async renderPdfView() {
    const container = document.getElementById('pdf-module-mount');
    if (!container) return;

    this.pdfModule = new PDFModule(container, (extractedText, folderId) => {
      this.switchView('generator', { prefill: { text: extractedText, folderId } });
    });
    await this.pdfModule.render();
  }

  async startQuizView(cards) {
    const container = document.getElementById('quiz-engine-mount');
    if (!container) return;

    const cardsToStudy = cards && cards.length > 0 ? cards : await db.getDueCards();
    this.quizEngine = new QuizEngine(container, () => this.switchView('dashboard'));
    this.quizEngine.startSession(cardsToStudy);
  }

  async startStudyView(cards) {
    const container = document.getElementById('study-engine-mount');
    if (!container) return;

    const cardsToStudy = cards && cards.length > 0 ? cards : await db.getCards();
    this.flashcardEngine = new FlashcardEngine(container, () => this.switchView('dashboard'));
    this.flashcardEngine.startSession(cardsToStudy);
  }

  renderGenerator(prefill = null) {
    const container = document.getElementById('generator-mount');
    if (!container) return;
    this.generatorModule = new GeneratorModule(container, () => this.switchView('dashboard'));
    this.generatorModule.render().then(() => {
      if (prefill) {
        if (prefill.text) {
          const textInput = document.getElementById('gen-notes-input');
          if (textInput) textInput.value = prefill.text;
        }
        if (prefill.folderId) {
          const folderSelect = document.getElementById('gen-folder-select');
          if (folderSelect) folderSelect.value = prefill.folderId;
        }
      }
    });
  }

  // --- MODALS ---
  bindModals() {
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      });
      modal.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => modal.classList.add('hidden'));
      });
    });

    document.getElementById('form-new-folder')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('input-folder-title').value.trim();
      const description = document.getElementById('input-folder-desc').value.trim();
      const icon = document.getElementById('input-folder-icon').value.trim() || '📁';
      if (!title) return;

      await db.saveFolder({ title, description, icon });
      document.getElementById('modal-new-folder').classList.add('hidden');
      document.getElementById('form-new-folder').reset();
      await this.renderDashboard();
    });

    document.getElementById('form-settings')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const key = document.getElementById('input-gemini-key').value.trim();
      const model = document.getElementById('input-gemini-model').value;

      await db.setSetting('gemini_api_key', key);
      await db.setSetting('gemini_model', model);

      document.getElementById('modal-settings').classList.add('hidden');
      alert('Configuración guardada exitosamente.');
    });
  }

  openNewFolderModal() {
    document.getElementById('modal-new-folder')?.classList.remove('hidden');
  }

  async openSettingsModal() {
    const modal = document.getElementById('modal-settings');
    const key = await db.getSetting('gemini_api_key', '');
    const model = await db.getSetting('gemini_model', 'gemini-2.5-flash');

    document.getElementById('input-gemini-key').value = key;
    document.getElementById('input-gemini-model').value = model;

    modal?.classList.remove('hidden');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
  window.app.init();
});
