/**
 * Multiple-Choice Quiz Engine (Exams & Self-Assessment)
 */
class QuizModule {
  constructor() {
    this.activeQuiz = null;
    this.currentQuestionIndex = 0;
    this.userAnswers = [];
    this.score = 0;
    this.hasAnsweredCurrent = false;
  }

  init() {
    this.bindEvents();
    this.renderQuizList();
  }

  bindEvents() {
    // Open AI Generator
    document.getElementById('btn-open-ai-quiz')?.addEventListener('click', () => {
      this.openAiGeneratorModal();
    });

    // Open Manual Creator
    document.getElementById('btn-open-manual-quiz')?.addEventListener('click', () => {
      this.openManualCreateModal();
    });

    // Form AI Submit
    document.getElementById('form-ai-quiz')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAiGenerate();
    });

    // Form Manual Submit
    document.getElementById('form-manual-quiz')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleManualCreate();
    });

    // Next Question Button
    document.getElementById('btn-quiz-next')?.addEventListener('click', () => {
      this.nextQuestion();
    });

    // Exit Quiz
    document.getElementById('btn-exit-quiz')?.addEventListener('click', () => {
      this.exitQuizMode();
    });

    // Restart Quiz
    document.getElementById('btn-restart-quiz')?.addEventListener('click', () => {
      if (this.activeQuiz) this.startQuizSession(this.activeQuiz.id);
    });

    // Convert missed questions to flashcards
    document.getElementById('btn-quiz-to-flashcards')?.addEventListener('click', () => {
      this.convertMissedToFlashcards();
    });
  }

  renderQuizList() {
    const container = document.getElementById('quiz-collections-grid');
    if (!container) return;

    const quizzes = window.appStorage.getQuizzes();
    if (quizzes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📝</span>
          <h3>No tienes cuestionarios creados aún</h3>
          <p>Genera cuestionarios de opción múltiple con IA sobre cualquier tema o crea los tuyos.</p>
          <div class="empty-actions">
            <button class="btn btn-primary" onclick="window.quizModule.openAiGeneratorModal()">
              ✨ Generar Quiz con Gemini IA
            </button>
            <button class="btn btn-secondary" onclick="window.quizModule.openManualCreateModal()">
              + Crear Pregunta Manual
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = quizzes.map(q => {
      const count = q.questions.length;
      return `
        <div class="deck-card">
          <div class="deck-header">
            <span class="badge badge-indigo">${q.category || 'Evaluación'}</span>
            <div class="deck-actions">
              <button class="icon-btn-danger" title="Eliminar cuestionario" onclick="window.quizModule.deleteQuiz('${q.id}')">🗑️</button>
            </div>
          </div>
          <h3 class="deck-title">${q.title}</h3>
          <p class="deck-desc">${q.description || `${count} preguntas de selección múltiple con retroalimentación.`}</p>

          <div class="quiz-card-meta">
            <span>🎯 ${count} Preguntas</span>
            <span>⚡ Selección Múltiple (A-D)</span>
          </div>

          <div class="deck-footer">
            <button class="btn btn-primary w-full" onclick="window.quizModule.startQuizSession('${q.id}')">
              ▶️ Comenzar Examen (${count} preguntas)
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  openAiGeneratorModal(prefilledTopic = '') {
    const modal = document.getElementById('modal-ai-quiz');
    const topicInput = document.getElementById('ai-quiz-topic');
    if (prefilledTopic && topicInput) {
      topicInput.value = prefilledTopic;
    }
    modal?.classList.add('active');
  }

  openCreateModalWithText(text) {
    this.openAiGeneratorModal();
    const contextInput = document.getElementById('ai-quiz-context');
    if (contextInput) {
      contextInput.value = text;
    }
  }

  openManualCreateModal() {
    this.populateQuizSelectDropdown();
    const modal = document.getElementById('modal-manual-quiz');
    modal?.classList.add('active');
  }

  populateQuizSelectDropdown() {
    const select = document.getElementById('manual-quiz-select');
    if (!select) return;
    const quizzes = window.appStorage.getQuizzes();
    select.innerHTML = `
      <option value="__new__">+ Crear nuevo cuestionario...</option>
      ${quizzes.map(q => `<option value="${q.id}">${q.title}</option>`).join('')}
    `;
  }

  async handleAiGenerate() {
    const topic = document.getElementById('ai-quiz-topic').value.trim();
    const context = document.getElementById('ai-quiz-context').value.trim();
    const count = parseInt(document.getElementById('ai-quiz-count').value, 10) || 5;
    const difficulty = document.getElementById('ai-quiz-difficulty').value;
    const btnSubmit = document.getElementById('btn-submit-ai-quiz');

    if (!topic) {
      window.app.showToast('Por favor escribe el tema para el cuestionario.', 'warning');
      return;
    }

    const origText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '⏳ Generando preguntas con Gemini...';
    btnSubmit.disabled = true;

    try {
      const questions = await window.geminiService.generateQuiz(topic, context, count, difficulty);

      const newQuiz = {
        id: 'quiz_' + Date.now(),
        title: topic,
        category: 'Examen IA',
        description: `Quiz generado con Gemini (${difficulty}) - ${questions.length} preguntas.`,
        questions: questions
      };

      window.appStorage.saveQuiz(newQuiz);
      window.app.closeModal('modal-ai-quiz');
      document.getElementById('form-ai-quiz').reset();

      this.renderQuizList();
      window.app.showToast(`¡Cuestionario "${topic}" creado con ${questions.length} preguntas!`, 'success');

      if (confirm(`Se han generado ${questions.length} preguntas. ¿Deseas resolver el quiz ahora?`)) {
        this.startQuizSession(newQuiz.id);
      }
    } catch (e) {
      console.error(e);
      window.app.showToast('Error al generar quiz: ' + e.message, 'danger');
    } finally {
      btnSubmit.innerHTML = origText;
      btnSubmit.disabled = false;
    }
  }

  handleManualCreate() {
    const quizSelect = document.getElementById('manual-quiz-select').value;
    const questionText = document.getElementById('manual-quiz-question').value.trim();
    const opt0 = document.getElementById('manual-opt-0').value.trim();
    const opt1 = document.getElementById('manual-opt-1').value.trim();
    const opt2 = document.getElementById('manual-opt-2').value.trim();
    const opt3 = document.getElementById('manual-opt-3').value.trim();
    const correctIndex = parseInt(document.querySelector('input[name="manual-correct"]:checked')?.value || '0', 10);
    const explanation = document.getElementById('manual-quiz-explanation').value.trim();

    if (!questionText || !opt0 || !opt1 || !opt2 || !opt3) {
      window.app.showToast('Por favor completa la pregunta y las 4 opciones.', 'warning');
      return;
    }

    let quizId = quizSelect;
    if (quizId === '__new__') {
      const newTitle = prompt('Nombre del nuevo cuestionario:', 'Cuestionario de Estudio');
      if (!newTitle) return;
      const newQuiz = {
        id: 'quiz_' + Date.now(),
        title: newTitle,
        category: 'Personal',
        description: 'Preguntas creadas manualmente.',
        questions: []
      };
      window.appStorage.saveQuiz(newQuiz);
      quizId = newQuiz.id;
    }

    const quizzes = window.appStorage.getQuizzes();
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz) return;

    quiz.questions.push({
      id: 'q_' + Date.now(),
      question: questionText,
      options: [opt0, opt1, opt2, opt3],
      correctIndex: correctIndex,
      explanation: explanation || 'Respuesta verificada.'
    });

    window.appStorage.saveQuiz(quiz);
    window.app.closeModal('modal-manual-quiz');
    document.getElementById('form-manual-quiz').reset();
    this.renderQuizList();
    window.app.showToast('Pregunta guardada exitosamente.', 'success');
  }

  deleteQuiz(id) {
    if (confirm('¿Deseas eliminar este cuestionario?')) {
      window.appStorage.deleteQuiz(id);
      this.renderQuizList();
      window.app.showToast('Cuestionario eliminado.', 'info');
    }
  }

  /* Interactive Quiz Play Mode */
  startQuizSession(quizId) {
    const quizzes = window.appStorage.getQuizzes();
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz || quiz.questions.length === 0) {
      window.app.showToast('Este cuestionario no contiene preguntas.', 'warning');
      return;
    }

    this.activeQuiz = quiz;
    this.currentQuestionIndex = 0;
    this.userAnswers = [];
    this.score = 0;
    this.hasAnsweredCurrent = false;

    document.getElementById('quiz-dashboard-view').classList.add('hidden');
    document.getElementById('quiz-play-view').classList.remove('hidden');
    document.getElementById('quiz-results-view').classList.add('hidden');

    document.getElementById('quiz-play-title').textContent = quiz.title;

    this.renderCurrentQuestion();
  }

  renderCurrentQuestion() {
    const q = this.activeQuiz.questions[this.currentQuestionIndex];
    const total = this.activeQuiz.questions.length;

    this.hasAnsweredCurrent = false;

    // Header counter and progress
    document.getElementById('quiz-progress-text').textContent = `Pregunta ${this.currentQuestionIndex + 1} de ${total}`;
    const pct = Math.round(((this.currentQuestionIndex) / total) * 100);
    document.getElementById('quiz-progress-fill').style.width = `${pct}%`;

    // Question statement
    document.getElementById('quiz-question-statement').textContent = q.question;

    // Options rendering
    const optionsContainer = document.getElementById('quiz-options-container');
    optionsContainer.innerHTML = '';

    const letters = ['A', 'B', 'C', 'D'];
    q.options.forEach((optText, index) => {
      const optBtn = document.createElement('button');
      optBtn.type = 'button';
      optBtn.className = 'quiz-option-btn';
      optBtn.innerHTML = `
        <span class="option-letter">${letters[index]}</span>
        <span class="option-text">${optText}</span>
        <span class="option-indicator"></span>
      `;
      optBtn.addEventListener('click', () => this.handleSelectOption(index));
      optionsContainer.appendChild(optBtn);
    });

    // Hide feedback & Next button until answered
    document.getElementById('quiz-explanation-box').classList.add('hidden');
    document.getElementById('btn-quiz-next').classList.add('hidden');
  }

  handleSelectOption(selectedIndex) {
    if (this.hasAnsweredCurrent) return;
    this.hasAnsweredCurrent = true;

    const q = this.activeQuiz.questions[this.currentQuestionIndex];
    const isCorrect = selectedIndex === q.correctIndex;

    if (isCorrect) {
      this.score++;
      if (window.calendarModule) window.calendarModule.playChime();
    }

    this.userAnswers.push({
      question: q,
      selectedIndex,
      isCorrect
    });

    // Highlight options
    const optionBtns = document.querySelectorAll('.quiz-option-btn');
    optionBtns.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === q.correctIndex) {
        btn.classList.add('option-correct');
      } else if (idx === selectedIndex && !isCorrect) {
        btn.classList.add('option-wrong');
      }
    });

    // Show Explanation Box
    const explanationBox = document.getElementById('quiz-explanation-box');
    const resultTag = document.getElementById('quiz-feedback-tag');
    const expText = document.getElementById('quiz-explanation-text');

    if (isCorrect) {
      resultTag.textContent = '🎉 ¡Correcto!';
      resultTag.className = 'badge badge-green';
    } else {
      resultTag.textContent = '❌ Incorrecto';
      resultTag.className = 'badge badge-red';
    }

    expText.textContent = q.explanation || 'Opción correcta verificada.';
    explanationBox.classList.remove('hidden');

    // Show Next or Finish Button
    const nextBtn = document.getElementById('btn-quiz-next');
    const isLast = this.currentQuestionIndex === this.activeQuiz.questions.length - 1;
    nextBtn.textContent = isLast ? '🏁 Ver Resultados' : 'Siguiente Pregunta ➔';
    nextBtn.classList.remove('hidden');
  }

  nextQuestion() {
    this.currentQuestionIndex++;
    if (this.currentQuestionIndex < this.activeQuiz.questions.length) {
      this.renderCurrentQuestion();
    } else {
      this.finishQuiz();
    }
  }

  finishQuiz() {
    document.getElementById('quiz-play-view').classList.add('hidden');
    document.getElementById('quiz-results-view').classList.remove('hidden');

    const total = this.activeQuiz.questions.length;
    const pct = Math.round((this.score / total) * 100);

    document.getElementById('quiz-results-score').textContent = `${this.score} / ${total}`;
    document.getElementById('quiz-results-pct').textContent = `${pct}% de acierto`;

    const badgeEl = document.getElementById('quiz-results-badge');
    if (pct >= 80) {
      badgeEl.textContent = '🏆 ¡Excelente dominio de la materia!';
      badgeEl.className = 'badge badge-green';
      if (window.confetti) {
        window.confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      }
    } else if (pct >= 60) {
      badgeEl.textContent = '👍 Buen resultado, refuerza los errores';
      badgeEl.className = 'badge badge-amber';
    } else {
      badgeEl.textContent = '⚠️ Se recomienda repasar con flashcards';
      badgeEl.className = 'badge badge-red';
    }

    // Missed questions button
    const missed = this.userAnswers.filter(a => !a.isCorrect);
    const toFlashcardsBtn = document.getElementById('btn-quiz-to-flashcards');
    if (missed.length > 0) {
      toFlashcardsBtn.classList.remove('hidden');
      toFlashcardsBtn.textContent = `🗂️ Crear Flashcards de ${missed.length} preguntas falladas`;
    } else {
      toFlashcardsBtn.classList.add('hidden');
    }

    // Render questions review breakdown
    const reviewContainer = document.getElementById('quiz-review-breakdown');
    if (reviewContainer) {
      reviewContainer.innerHTML = this.userAnswers.map((ans, idx) => `
        <div class="quiz-review-item ${ans.isCorrect ? 'review-correct' : 'review-wrong'}">
          <div class="review-header">
            <span>Pregunta ${idx + 1}: ${ans.isCorrect ? '✅ Acertada' : '❌ Fallada'}</span>
          </div>
          <p class="review-question"><strong>${ans.question.question}</strong></p>
          <p class="review-answer">Tu respuesta: <em>${ans.question.options[ans.selectedIndex]}</em></p>
          ${!ans.isCorrect ? `<p class="review-correct-answer">Respuesta correcta: <strong>${ans.question.options[ans.question.correctIndex]}</strong></p>` : ''}
          <p class="review-explanation">💡 ${ans.question.explanation}</p>
        </div>
      `).join('');
    }
  }

  convertMissedToFlashcards() {
    const missed = this.userAnswers.filter(a => !a.isCorrect);
    if (missed.length === 0) return;

    const cards = missed.map(m => ({
      id: 'fc_from_quiz_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      front: m.question.question,
      back: `Respuesta correcta:\n${m.question.options[m.question.correctIndex]}\n\nExplicación:\n${m.question.explanation}`,
      hint: 'Pregunta fallada en quiz de evaluación',
      state: 'new',
      reviews: 0,
      lastReviewed: null
    }));

    const newDeck = {
      id: 'deck_reinforce_' + Date.now(),
      title: `Refuerzo: ${this.activeQuiz.title}`,
      category: 'Refuerzo de Errores',
      description: `Generado a partir de ${missed.length} preguntas falladas en el examen.`,
      cards: cards
    };

    window.appStorage.saveDeck(newDeck);
    window.app.showToast(`¡Se ha creado el mazo de refuerzo con ${cards.length} tarjetas!`, 'success');
    window.app.switchTab('flashcards');
    window.flashcardsModule.renderDecksList();
  }

  exitQuizMode() {
    document.getElementById('quiz-play-view').classList.add('hidden');
    document.getElementById('quiz-results-view').classList.add('hidden');
    document.getElementById('quiz-dashboard-view').classList.remove('hidden');
    this.renderQuizList();
  }
}

window.quizModule = new QuizModule();
