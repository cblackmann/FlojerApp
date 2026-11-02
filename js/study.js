/**
 * 3D Flashcard & Spaced Repetition (Active Recall) Engine
 */
import { db } from './db.js';
import { SRSEngine, SRS_GRADES } from './srs.js';

export class FlashcardEngine {
  constructor(containerElement, onSessionComplete) {
    this.container = containerElement;
    this.onSessionComplete = onSessionComplete;
    this.queue = [];
    this.currentIndex = 0;
    this.isFlipped = false;
    this.startTime = null;
  }

  startSession(cards) {
    if (!cards || cards.length === 0) {
      this.renderEmptyState();
      return;
    }
    this.queue = [...cards];
    this.currentIndex = 0;
    this.isFlipped = false;
    this.renderCurrentCard();
  }

  renderEmptyState() {
    this.container.innerHTML = `
      <div class="text-center py-16 px-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 max-w-xl mx-auto shadow-xl">
        <span class="text-5xl block mb-4">🗂️</span>
        <h3 class="text-2xl font-bold text-slate-100 mb-2">¡Mazo completado!</h3>
        <p class="text-slate-400 mb-6">No hay tarjetas pendientes para repasar en este mazo.</p>
        <button id="btn-fc-back-dash" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition">
          Volver al Dashboard
        </button>
      </div>
    `;
    this.container.querySelector('#btn-fc-back-dash')?.addEventListener('click', () => {
      if (this.onSessionComplete) this.onSessionComplete();
    });
  }

  renderCurrentCard() {
    if (this.currentIndex >= this.queue.length) {
      if (this.onSessionComplete) this.onSessionComplete();
      return;
    }

    const card = this.queue[this.currentIndex];
    this.isFlipped = false;
    this.startTime = Date.now();

    const progressPct = Math.round(((this.currentIndex) / this.queue.length) * 100);

    this.container.innerHTML = `
      <div class="max-w-2xl mx-auto">
        <!-- Progress Bar & Counter -->
        <div class="flex items-center justify-between mb-4 text-xs font-semibold text-slate-400">
          <span>Tarjeta ${this.currentIndex + 1} de ${this.queue.length}</span>
          <button id="btn-exit-fc" class="hover:text-rose-400 transition">✕ Salir</button>
        </div>
        <div class="w-full bg-slate-700/40 h-1.5 rounded-full mb-6 overflow-hidden">
          <div class="bg-indigo-500 h-full transition-all duration-300" style="width: ${progressPct}%"></div>
        </div>

        <!-- 3D Card Wrapper -->
        <div id="flashcard-3d-box" class="flashcard-box group relative w-full h-[360px] cursor-pointer select-none mb-6">
          <div class="card-inner w-full h-full relative transition-transform duration-500 [transform-style:preserve-3d]">
            
            <!-- Anverso (Pregunta) -->
            <div class="card-face absolute inset-0 bg-slate-800/90 border border-slate-700/90 rounded-2xl p-8 flex flex-col justify-between shadow-2xl [backface-visibility:hidden]">
              <div class="flex justify-between items-center text-xs text-indigo-400 font-bold uppercase tracking-wider">
                <span>Pregunta / Active Recall</span>
                <span>Intervalo: ${card.intervalo}d</span>
              </div>
              <div class="text-xl md:text-2xl font-bold text-slate-100 text-center my-auto leading-relaxed">
                ${card.pregunta}
              </div>
              <div class="text-center text-xs text-slate-500">
                Haz clic o pulsa <kbd class="px-2 py-0.5 bg-slate-700 rounded text-slate-300">Espacio</kbd> para voltear
              </div>
            </div>

            <!-- Reverso (Respuesta y Explicación) -->
            <div class="card-face absolute inset-0 bg-slate-900 border border-indigo-500/50 rounded-2xl p-8 flex flex-col justify-between shadow-2xl [transform:rotateY(180deg)] [backface-visibility:hidden]">
              <div class="flex justify-between items-center text-xs text-emerald-400 font-bold uppercase tracking-wider">
                <span>Respuesta y Justificación</span>
                <span>Ease: ${(card.facilidad || 2.5).toFixed(2)}</span>
              </div>
              <div class="text-sm md:text-base text-slate-200 overflow-y-auto max-h-[220px] my-auto leading-relaxed whitespace-pre-line text-left">
                ${card.explicacion_detallada || card.opciones?.[card.respuesta_correcta] || 'Respuesta verificada.'}
              </div>
              <div class="text-center text-xs text-slate-500">
                Califica tu retención abajo con las teclas [1], [2], [3] o [4]
              </div>
            </div>

          </div>
        </div>

        <!-- Controles de Flip y Calificación SM-2 -->
        <div id="fc-controls" class="space-y-3">
          <button id="btn-toggle-flip" class="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-xl transition">
            🔄 Mostrar Respuesta (Espacio)
          </button>

          <div id="fc-ratings" class="hidden grid grid-cols-4 gap-2">
            <button data-grade="1" class="fc-grade-btn py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition">
              🔴 Otra vez [1]
            </button>
            <button data-grade="2" class="fc-grade-btn py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition">
              🟡 Difícil [2]
            </button>
            <button data-grade="3" class="fc-grade-btn py-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-xs font-bold transition">
              🔵 Bueno [3]
            </button>
            <button data-grade="4" class="fc-grade-btn py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition">
              🟢 Fácil [4]
            </button>
          </div>
        </div>

      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const box = this.container.querySelector('#flashcard-3d-box');
    const toggleBtn = this.container.querySelector('#btn-toggle-flip');
    const ratingsPanel = this.container.querySelector('#fc-ratings');

    const toggle = () => {
      this.isFlipped = !this.isFlipped;
      box.querySelector('.card-inner').style.transform = this.isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
      if (this.isFlipped) {
        toggleBtn.classList.add('hidden');
        ratingsPanel.classList.remove('hidden');
      } else {
        toggleBtn.classList.remove('hidden');
        ratingsPanel.classList.add('hidden');
      }
    };

    box?.addEventListener('click', toggle);
    toggleBtn?.addEventListener('click', toggle);

    this.container.querySelector('#btn-exit-fc')?.addEventListener('click', () => {
      if (this.onSessionComplete) this.onSessionComplete();
    });

    this.container.querySelectorAll('.fc-grade-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const grade = parseInt(btn.dataset.grade, 10);
        this.rateCard(grade);
      });
    });

    this.keyHandler = (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        toggle();
      } else if (this.isFlipped && ['1', '2', '3', '4'].includes(e.key)) {
        this.rateCard(parseInt(e.key, 10));
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  async rateCard(grade) {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
    }
    const card = this.queue[this.currentIndex];
    const responseTimeMs = Date.now() - this.startTime;
    const isCorrect = grade >= 2;

    const srsUpdate = SRSEngine.calculateNextReview(card, grade);
    await db.logReview(card.id, grade, responseTimeMs, isCorrect, srsUpdate);

    this.currentIndex++;
    this.renderCurrentCard();
  }
}
