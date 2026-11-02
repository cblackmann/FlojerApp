/**
 * Flashcards & Spaced Repetition Study Engine
 */
class FlashcardsModule {
  constructor() {
    this.activeDeck = null;
    this.studyQueue = [];
    this.currentCardIndex = 0;
    this.isFlipped = false;
    this.sessionStats = { mastered: 0, review: 0, hard: 0 };
    this.keyListenerBound = false;
  }

  init() {
    this.bindEvents();
    this.renderDecksList();
  }

  bindEvents() {
    // Open AI Generator Modal
    document.getElementById('btn-open-ai-flashcards')?.addEventListener('click', () => {
      this.openAiGeneratorModal();
    });

    // Open Manual Card Modal
    document.getElementById('btn-open-manual-flashcard')?.addEventListener('click', () => {
      this.openManualCreateModal();
    });

    // AI Form Submit
    document.getElementById('form-ai-flashcards')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAiGenerate();
    });

    // Manual Form Submit
    document.getElementById('form-manual-flashcard')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleManualCreate();
    });

    // Study Controls
    const studyCard = document.getElementById('study-flashcard');
    studyCard?.addEventListener('click', () => this.toggleFlip());

    document.getElementById('btn-flip-card')?.addEventListener('click', () => this.toggleFlip());
    document.getElementById('btn-rate-hard')?.addEventListener('click', () => this.rateCard('hard'));
    document.getElementById('btn-rate-medium')?.addEventListener('click', () => this.rateCard('learning'));
    document.getElementById('btn-rate-easy')?.addEventListener('click', () => this.rateCard('mastered'));

    document.getElementById('btn-exit-study')?.addEventListener('click', () => {
      this.exitStudyMode();
    });

    document.getElementById('btn-restart-study')?.addEventListener('click', () => {
      if (this.activeDeck) this.startStudySession(this.activeDeck.id);
    });
  }

  renderDecksList() {
    const container = document.getElementById('flashcard-decks-grid');
    if (!container) return;

    const decks = window.appStorage.getFlashcardDecks();
    if (decks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🗂️</span>
          <h3>No tienes mazos de flashcards aún</h3>
          <p>Crea tu primer mazo sobre cualquier materia con ayuda de la IA o manualmente.</p>
          <div class="empty-actions">
            <button class="btn btn-primary" onclick="window.flashcardsModule.openAiGeneratorModal()">
              ✨ Generar Mazo con Gemini IA
            </button>
            <button class="btn btn-secondary" onclick="window.flashcardsModule.openManualCreateModal()">
              + Crear Manualmente
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = decks.map(deck => {
      const total = deck.cards.length;
      const mastered = deck.cards.filter(c => c.state === 'mastered').length;
      const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;

      return `
        <div class="deck-card">
          <div class="deck-header">
            <span class="badge badge-accent">${deck.category || 'General'}</span>
            <div class="deck-actions">
              <button class="icon-btn" title="Añadir tarjeta a este mazo" onclick="window.flashcardsModule.openAddCardToDeck('${deck.id}')">➕</button>
              <button class="icon-btn-danger" title="Eliminar mazo" onclick="window.flashcardsModule.deleteDeck('${deck.id}')">🗑️</button>
            </div>
          </div>
          <h3 class="deck-title">${deck.title}</h3>
          <p class="deck-desc">${deck.description || `${total} tarjetas de estudio activo.`}</p>
          
          <div class="deck-progress-container">
            <div class="deck-progress-labels">
              <span>Dominadas: ${mastered}/${total}</span>
              <span>${pct}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${pct}%"></div>
            </div>
          </div>

          <div class="deck-footer">
            <button class="btn btn-primary w-full" onclick="window.flashcardsModule.startStudySession('${deck.id}')">
              🚀 Iniciar Repaso (${total} cards)
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  openAiGeneratorModal(prefilledTopic = '') {
    const modal = document.getElementById('modal-ai-flashcards');
    const topicInput = document.getElementById('ai-fc-topic');
    const contextInput = document.getElementById('ai-fc-context');

    if (prefilledTopic && topicInput) {
      topicInput.value = prefilledTopic;
    }

    // Check if we have active PDF text or highlights
    if (contextInput && !contextInput.value) {
      const activeHighlights = window.appStorage.getHighlights();
      if (activeHighlights.length > 0) {
        contextInput.placeholder = `Opcional: puedes dejar en blanco para usar tus ${activeHighlights.length} fragmentos destacados o pegar tus apuntes.`;
      }
    }

    modal?.classList.add('active');
  }

  openCreateModalWithText(text) {
    this.openAiGeneratorModal();
    const contextInput = document.getElementById('ai-fc-context');
    if (contextInput) {
      contextInput.value = text;
    }
  }

  openManualCreateModal() {
    this.populateDeckSelectDropdown();
    const modal = document.getElementById('modal-manual-flashcard');
    modal?.classList.add('active');
  }

  openAddCardToDeck(deckId) {
    this.populateDeckSelectDropdown(deckId);
    const modal = document.getElementById('modal-manual-flashcard');
    modal?.classList.add('active');
  }

  populateDeckSelectDropdown(selectedId = null) {
    const select = document.getElementById('manual-fc-deck-select');
    if (!select) return;
    const decks = window.appStorage.getFlashcardDecks();
    select.innerHTML = `
      <option value="__new__">+ Crear nuevo mazo...</option>
      ${decks.map(d => `<option value="${d.id}" ${d.id === selectedId ? 'selected' : ''}>${d.title}</option>`).join('')}
    `;
  }

  async handleAiGenerate() {
    const topic = document.getElementById('ai-fc-topic').value.trim();
    const context = document.getElementById('ai-fc-context').value.trim();
    const count = parseInt(document.getElementById('ai-fc-count').value, 10) || 5;
    const difficulty = document.getElementById('ai-fc-difficulty').value;
    const btnSubmit = document.getElementById('btn-submit-ai-fc');

    if (!topic) {
      window.app.showToast('Por favor escribe el tema o materia a repasar.', 'warning');
      return;
    }

    const origText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '⏳ Generando con Gemini...';
    btnSubmit.disabled = true;

    try {
      const cards = await window.geminiService.generateFlashcards(topic, context, count, difficulty);
      
      const newDeck = {
        id: 'deck_' + Date.now(),
        title: topic,
        category: 'Estudio IA',
        description: `Mazo generado automáticamente con Gemini (${difficulty}).`,
        cards: cards
      };

      window.appStorage.saveDeck(newDeck);
      window.app.closeModal('modal-ai-flashcards');
      document.getElementById('form-ai-flashcards').reset();

      this.renderDecksList();
      window.app.showToast(`¡Mazo "${topic}" creado con ${cards.length} flashcards!`, 'success');

      // Prompt to start immediately
      if (confirm(`Se han generado ${cards.length} tarjetas. ¿Deseas iniciar la sesión de repaso ahora?`)) {
        this.startStudySession(newDeck.id);
      }
    } catch (e) {
      console.error(e);
      window.app.showToast('Error al generar flashcards: ' + e.message, 'danger');
    } finally {
      btnSubmit.innerHTML = origText;
      btnSubmit.disabled = false;
    }
  }

  handleManualCreate() {
    const deckSelect = document.getElementById('manual-fc-deck-select').value;
    const front = document.getElementById('manual-fc-front').value.trim();
    const back = document.getElementById('manual-fc-back').value.trim();
    const hint = document.getElementById('manual-fc-hint').value.trim();

    if (!front || !back) {
      window.app.showToast('Por favor completa el anverso y el reverso.', 'warning');
      return;
    }

    let deckId = deckSelect;
    if (deckId === '__new__') {
      const newTitle = prompt('Nombre del nuevo mazo:', 'Nuevo Mazo de Estudio');
      if (!newTitle) return;
      const newDeck = {
        id: 'deck_' + Date.now(),
        title: newTitle,
        category: 'Personal',
        description: 'Mazo creado manualmente.',
        cards: []
      };
      window.appStorage.saveDeck(newDeck);
      deckId = newDeck.id;
    }

    const decks = window.appStorage.getFlashcardDecks();
    const deck = decks.find(d => d.id === deckId);
    if (!deck) return;

    deck.cards.push({
      id: 'fc_' + Date.now(),
      front,
      back,
      hint,
      state: 'new',
      reviews: 0,
      lastReviewed: null
    });

    window.appStorage.saveDeck(deck);
    window.app.closeModal('modal-manual-flashcard');
    document.getElementById('form-manual-flashcard').reset();
    this.renderDecksList();
    window.app.showToast('Tarjeta añadida exitosamente.', 'success');
  }

  deleteDeck(id) {
    if (confirm('¿Seguro que deseas eliminar este mazo completo?')) {
      window.appStorage.deleteDeck(id);
      this.renderDecksList();
      window.app.showToast('Mazo eliminado.', 'info');
    }
  }

  /* Interactive Study Session */
  startStudySession(deckId) {
    const decks = window.appStorage.getFlashcardDecks();
    const deck = decks.find(d => d.id === deckId);
    if (!deck || deck.cards.length === 0) {
      window.app.showToast('Este mazo no tiene tarjetas para repasar.', 'warning');
      return;
    }

    this.activeDeck = deck;
    // Shuffle cards for optimal review
    this.studyQueue = [...deck.cards].sort(() => Math.random() - 0.5);
    this.currentCardIndex = 0;
    this.isFlipped = false;
    this.sessionStats = { mastered: 0, review: 0, hard: 0 };

    document.getElementById('flashcards-dashboard-view').classList.add('hidden');
    document.getElementById('flashcards-study-view').classList.remove('hidden');
    document.getElementById('study-summary-view').classList.add('hidden');

    document.getElementById('study-deck-name').textContent = deck.title;

    this.renderCurrentCard();
    this.bindStudyKeyboardShortcuts();
  }

  renderCurrentCard() {
    if (this.currentCardIndex >= this.studyQueue.length) {
      this.finishStudySession();
      return;
    }

    const card = this.studyQueue[this.currentCardIndex];
    const total = this.studyQueue.length;

    // Reset flip
    this.isFlipped = false;
    const cardEl = document.getElementById('study-flashcard');
    cardEl.classList.remove('flipped');

    // Progress
    document.getElementById('study-progress-counter').textContent = `Tarjeta ${this.currentCardIndex + 1} de ${total}`;
    const pct = Math.round(((this.currentCardIndex) / total) * 100);
    document.getElementById('study-progress-bar-fill').style.width = `${pct}%`;

    // Content
    document.getElementById('card-front-text').textContent = card.front;
    document.getElementById('card-back-text').textContent = card.back;

    const hintContainer = document.getElementById('card-hint-container');
    const hintText = document.getElementById('card-hint-text');
    if (card.hint) {
      hintContainer.classList.remove('hidden');
      hintText.textContent = card.hint;
    } else {
      hintContainer.classList.add('hidden');
    }

    // Toggle button bar (hide ratings until flipped)
    document.getElementById('study-rating-buttons').classList.add('hidden');
    document.getElementById('study-flip-prompt').classList.remove('hidden');
  }

  toggleFlip() {
    this.isFlipped = !this.isFlipped;
    const cardEl = document.getElementById('study-flashcard');
    cardEl.classList.toggle('flipped', this.isFlipped);

    if (this.isFlipped) {
      document.getElementById('study-rating-buttons').classList.remove('hidden');
      document.getElementById('study-flip-prompt').classList.add('hidden');
    } else {
      document.getElementById('study-rating-buttons').classList.add('hidden');
      document.getElementById('study-flip-prompt').classList.remove('hidden');
    }
  }

  rateCard(rating) {
    const card = this.studyQueue[this.currentCardIndex];

    if (rating === 'hard') {
      this.sessionStats.hard++;
      card.state = 'learning';
      // Re-insert card 3 positions ahead in the queue so it is reviewed again
      this.studyQueue.splice(this.currentCardIndex + 3, 0, card);
    } else if (rating === 'learning') {
      this.sessionStats.review++;
      card.state = 'learning';
    } else if (rating === 'mastered') {
      this.sessionStats.mastered++;
      card.state = 'mastered';
    }

    card.reviews = (card.reviews || 0) + 1;
    card.lastReviewed = Date.now();

    // Persist card update in storage
    window.appStorage.saveDeck(this.activeDeck);

    this.currentCardIndex++;
    this.renderCurrentCard();
  }

  finishStudySession() {
    this.unbindStudyKeyboardShortcuts();
    document.getElementById('flashcards-study-view').classList.add('hidden');
    document.getElementById('study-summary-view').classList.remove('hidden');

    document.getElementById('summary-total-cards').textContent = this.studyQueue.length;
    document.getElementById('summary-mastered').textContent = this.sessionStats.mastered;
    document.getElementById('summary-review').textContent = this.sessionStats.review;
    document.getElementById('summary-hard').textContent = this.sessionStats.hard;

    // Trigger celebration confetti!
    if (window.confetti) {
      window.confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }

  exitStudyMode() {
    this.unbindStudyKeyboardShortcuts();
    document.getElementById('flashcards-study-view').classList.add('hidden');
    document.getElementById('study-summary-view').classList.add('hidden');
    document.getElementById('flashcards-dashboard-view').classList.remove('hidden');
    this.renderDecksList();
  }

  bindStudyKeyboardShortcuts() {
    if (this.keyListenerBound) return;
    this.keyHandler = (e) => {
      // Only trigger if study view is active and not typing in an input
      if (document.getElementById('flashcards-study-view').classList.contains('hidden')) return;
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.toggleFlip();
      } else if (this.isFlipped) {
        if (e.key === '1') this.rateCard('hard');
        if (e.key === '2') this.rateCard('learning');
        if (e.key === '3') this.rateCard('mastered');
      }
    };
    window.addEventListener('keydown', this.keyHandler);
    this.keyListenerBound = true;
  }

  unbindStudyKeyboardShortcuts() {
    if (this.keyListenerBound && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyListenerBound = false;
    }
  }
}

window.flashcardsModule = new FlashcardsModule();
