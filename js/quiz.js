/**
 * Interactive Quiz & Assessment Engine
 * Preguntas de opción múltiple con retroalimentación oculta, desglose paso a paso y calificación SRS
 */
import { db } from './db.js';
import { SRSEngine, SRS_GRADES } from './srs.js';

export class QuizEngine {
  constructor(containerElement, onSessionComplete) {
    this.container = containerElement;
    this.onSessionComplete = onSessionComplete;
    this.queue = [];
    this.currentIndex = 0;
    this.selectedOption = null;
    this.hasAnswered = false;
    this.questionStartTime = null;
    this.timerInterval = null;
    this.sessionStats = { total: 0, correct: 0, totalTimeMs: 0 };
  }

  startSession(cards) {
    if (!cards || cards.length === 0) {
      this.renderEmptyState();
      return;
    }

    this.queue = [...cards];
    this.currentIndex = 0;
    this.sessionStats = { total: cards.length, correct: 0, totalTimeMs: 0 };
    this.renderCurrentQuestion();
  }

  renderEmptyState() {
    this.container.innerHTML = `
      <div class="text-center py-16 px-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 max-w-xl mx-auto shadow-xl">
        <span class="text-5xl block mb-4">🎉</span>
        <h3 class="text-2xl font-bold text-slate-100 mb-2">¡Todo al día!</h3>
        <p class="text-slate-400 mb-6">No tienes preguntas ni tarjetas pendientes para revisión en este momento según el algoritmo de repetición espaciada.</p>
        <button id="btn-quiz-back-dash" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition">
          Volver al Dashboard
        </button>
      </div>
    `;
    this.container.querySelector('#btn-quiz-back-dash')?.addEventListener('click', () => {
      if (this.onSessionComplete) this.onSessionComplete();
    });
  }

  renderCurrentQuestion() {
    if (this.currentIndex >= this.queue.length) {
      this.finishSession();
      return;
    }

    const card = this.queue[this.currentIndex];
    this.selectedOption = null;
    this.hasAnswered = false;
    this.questionStartTime = Date.now();

    const progressPct = Math.round(((this.currentIndex) / this.queue.length) * 100);
    const letters = ['A', 'B', 'C', 'D'];

    this.container.innerHTML = `
      <div class="max-w-3xl mx-auto bg-slate-800/80 backdrop-blur border border-slate-700/80 rounded-2xl p-6 md:p-8 shadow-2xl transition-all">
        
        <!-- Header: Barra de progreso, contador y cronómetro -->
        <div class="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-700/60">
          <div class="flex items-center gap-3">
            <span class="px-2.5 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">
              Pregunta ${this.currentIndex + 1} de ${this.queue.length}
            </span>
            ${card.etiquetas?.length ? `<span class="text-xs text-slate-400 hidden sm:inline">🏷️ ${card.etiquetas.join(', ')}</span>` : ''}
          </div>
          
          <div class="flex items-center gap-4">
            <span id="quiz-elapsed-timer" class="text-xs font-mono font-semibold text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
              ⏱️ 0.0s
            </span>
            <button id="btn-abort-quiz" class="text-xs text-slate-400 hover:text-rose-400 transition" title="Salir de la sesión">
              ✕ Salir
            </button>
          </div>
        </div>

        <!-- Barra de progreso visual -->
        <div class="w-full bg-slate-700/40 h-1.5 rounded-full mb-6 overflow-hidden">
          <div class="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-300" style="width: ${progressPct}%"></div>
        </div>

        <!-- Enunciado de la Pregunta -->
        <h3 class="text-lg md:text-xl font-bold text-slate-100 leading-relaxed mb-6">
          ${card.pregunta}
        </h3>

        <!-- Opciones A, B, C, D -->
        <div id="quiz-options-list" class="space-y-3 mb-6">
          ${card.opciones.map((optText, idx) => `
            <button type="button" data-index="${idx}" class="quiz-opt-btn w-full text-left p-4 rounded-xl border border-slate-700 bg-slate-900/50 hover:bg-slate-700/40 hover:border-indigo-500/50 text-slate-200 transition flex items-start gap-3.5 group">
              <span class="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-700 group-hover:border-indigo-400/50 group-hover:text-indigo-300">
                ${letters[idx]}
              </span>
              <span class="text-sm md:text-base leading-snug flex-1">${optText}</span>
            </button>
          `).join('')}
        </div>

        <!-- Contenedor de Retroalimentación Oculta (se devela al responder) -->
        <div id="quiz-feedback-panel" class="hidden mt-6 p-5 rounded-xl border border-slate-700/80 bg-slate-900/80 animate-fadeIn">
          <div class="flex items-center gap-2.5 mb-3">
            <span id="feedback-badge" class="px-2.5 py-1 text-xs font-bold rounded-lg uppercase tracking-wider"></span>
            <span class="text-xs text-slate-400 font-semibold">Desglose de Justificación Académica:</span>
          </div>
          <div id="feedback-explanation" class="text-sm text-slate-300 leading-relaxed whitespace-pre-line mb-6 font-normal"></div>

          <!-- Botones de Calificación del Algoritmo SM-2 -->
          <div class="border-t border-slate-800 pt-4">
            <p class="text-xs text-slate-400 font-semibold mb-3 text-center sm:text-left">
              ¿Qué tan fácil te resultó recordar este concepto? (Calibra tu algoritmo SM-2):
            </p>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button data-grade="1" class="srs-grade-btn py-2 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex flex-col items-center">
                <span>🔴 Otra vez</span>
                <span class="text-[10px] font-normal opacity-80 mt-0.5">Fallo total [1]</span>
              </button>
              <button data-grade="2" class="srs-grade-btn py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex flex-col items-center">
                <span>🟡 Difícil</span>
                <span class="text-[10px] font-normal opacity-80 mt-0.5">Con esfuerzo [2]</span>
              </button>
              <button data-grade="3" class="srs-grade-btn py-2 px-3 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-xs font-bold transition flex flex-col items-center">
                <span>🔵 Bueno</span>
                <span class="text-[10px] font-normal opacity-80 mt-0.5">Estándar [3]</span>
              </button>
              <button data-grade="4" class="srs-grade-btn py-2 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition flex flex-col items-center">
                <span>🟢 Fácil</span>
                <span class="text-[10px] font-normal opacity-80 mt-0.5">Instantáneo [4]</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    `;

    this.bindQuestionEvents();
    this.startTimer();
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    const timerEl = this.container.querySelector('#quiz-elapsed-timer');
    this.timerInterval = setInterval(() => {
      const elapsed = ((Date.now() - this.questionStartTime) / 1000).toFixed(1);
      if (timerEl) timerEl.textContent = `⏱️ ${elapsed}s`;
    }, 100);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  bindQuestionEvents() {
    const card = this.queue[this.currentIndex];

    // Opciones click
    this.container.querySelectorAll('.quiz-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.hasAnswered) return;
        const index = parseInt(btn.dataset.index, 10);
        this.handleSelectOption(index);
      });
    });

    // Salir
    this.container.querySelector('#btn-abort-quiz')?.addEventListener('click', () => {
      if (confirm('¿Deseas interrumpir la sesión de estudio actual?')) {
        this.stopTimer();
        if (this.onSessionComplete) this.onSessionComplete();
      }
    });

    // Botones de calificación SRS
    this.container.querySelectorAll('.srs-grade-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const grade = parseInt(btn.dataset.grade, 10);
        this.handleSrsRate(grade);
      });
    });

    // Atajos de teclado (1, 2, 3, 4)
    this.keyHandler = (e) => {
      if (!this.hasAnswered) return;
      if (['1', '2', '3', '4'].includes(e.key)) {
        this.handleSrsRate(parseInt(e.key, 10));
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  handleSelectOption(selectedIndex) {
    this.stopTimer();
    this.hasAnswered = true;
    this.selectedOption = selectedIndex;

    const card = this.queue[this.currentIndex];
    const isCorrect = selectedIndex === card.respuesta_correcta;

    if (isCorrect) {
      this.sessionStats.correct++;
    }

    // Resaltar alternativas
    this.container.querySelectorAll('.quiz-opt-btn').forEach((btn, idx) => {
      btn.classList.add('cursor-default');
      if (idx === card.respuesta_correcta) {
        btn.classList.remove('bg-slate-900/50', 'border-slate-700');
        btn.classList.add('bg-emerald-950/60', 'border-emerald-500/80', 'text-emerald-200');
        btn.querySelector('span:first-child').classList.add('bg-emerald-600', 'text-white', 'border-emerald-400');
      } else if (idx === selectedIndex && !isCorrect) {
        btn.classList.remove('bg-slate-900/50', 'border-slate-700');
        btn.classList.add('bg-rose-950/60', 'border-rose-500/80', 'text-rose-200');
        btn.querySelector('span:first-child').classList.add('bg-rose-600', 'text-white', 'border-rose-400');
      } else {
        btn.classList.add('opacity-40');
      }
    });

    // Revelar panel de explicación
    const feedbackPanel = this.container.querySelector('#quiz-feedback-panel');
    const feedbackBadge = this.container.querySelector('#feedback-badge');
    const feedbackText = this.container.querySelector('#feedback-explanation');

    if (isCorrect) {
      feedbackBadge.textContent = '🎉 ¡Respuesta Correcta!';
      feedbackBadge.className = 'px-2.5 py-1 text-xs font-bold rounded-lg uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    } else {
      feedbackBadge.textContent = '❌ Respuesta Incorrecta';
      feedbackBadge.className = 'px-2.5 py-1 text-xs font-bold rounded-lg uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30';
    }

    feedbackText.textContent = card.explicacion_detallada;
    feedbackPanel.classList.remove('hidden');

    // Desplazar vista hacia la explicación suavemente
    feedbackPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async handleSrsRate(grade) {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
    }

    const card = this.queue[this.currentIndex];
    const responseTimeMs = Date.now() - this.questionStartTime;
    this.sessionStats.totalTimeMs += responseTimeMs;

    const isCorrect = this.selectedOption === card.respuesta_correcta;
    const srsUpdate = SRSEngine.calculateNextReview(card, grade);

    // Persistir resultado y métrica en la base de datos
    await db.logReview(card.id, grade, responseTimeMs, isCorrect, srsUpdate);

    this.currentIndex++;
    this.renderCurrentQuestion();
  }

  finishSession() {
    this.stopTimer();
    const total = this.sessionStats.total;
    const correct = this.sessionStats.correct;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const avgTimeSec = total > 0 ? ((this.sessionStats.totalTimeMs / total) / 1000).toFixed(1) : '0';

    // Disparar confeti si el rendimiento fue alto
    if (window.confetti && pct >= 60) {
      window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }

    this.container.innerHTML = `
      <div class="max-w-xl mx-auto bg-slate-800/90 border border-slate-700/80 rounded-2xl p-8 shadow-2xl text-center">
        <span class="text-6xl block mb-4">🏆</span>
        <h2 class="text-2xl font-bold text-slate-100 mb-2">¡Sesión de Estudio Completada!</h2>
        <p class="text-slate-400 text-sm mb-6">Tus repasos han sido procesados y las próximas revisiones programadas por el algoritmo.</p>

        <div class="grid grid-cols-3 gap-3 mb-8">
          <div class="bg-slate-900/70 p-4 rounded-xl border border-slate-700/60">
            <span class="text-2xl font-extrabold text-indigo-400 block mb-1">${correct}/${total}</span>
            <span class="text-[11px] uppercase font-bold text-slate-400">Aciertos</span>
          </div>
          <div class="bg-slate-900/70 p-4 rounded-xl border border-slate-700/60">
            <span class="text-2xl font-extrabold ${pct >= 70 ? 'text-emerald-400' : 'text-amber-400'} block mb-1">${pct}%</span>
            <span class="text-[11px] uppercase font-bold text-slate-400">Tasa de Acierto</span>
          </div>
          <div class="bg-slate-900/70 p-4 rounded-xl border border-slate-700/60">
            <span class="text-2xl font-extrabold text-blue-400 block mb-1">${avgTimeSec}s</span>
            <span class="text-[11px] uppercase font-bold text-slate-400">Promedio/Pregunta</span>
          </div>
        </div>

        <button id="btn-finish-quiz-session" class="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition">
          Continuar al Dashboard
        </button>
      </div>
    `;

    this.container.querySelector('#btn-finish-quiz-session')?.addEventListener('click', () => {
      if (this.onSessionComplete) this.onSessionComplete();
    });
  }
}
