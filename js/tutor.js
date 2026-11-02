/**
 * AI Tutor Module - Google Gemini Integration
 */
class TutorModule {
  constructor() {
    this.messages = [];
    this.contextDocument = '';
    this.isGenerating = false;
    this.speechUtterance = null;
  }

  init() {
    this.bindEvents();
    this.loadInitialGreeting();
    this.updateStatusBanner();
  }

  bindEvents() {
    const form = document.getElementById('tutor-form');
    const input = document.getElementById('tutor-input');

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || this.isGenerating) return;
      this.sendUserMessage(text);
      input.value = '';
      this.autoResizeTextarea(input);
    });

    // Auto resize input textarea
    input?.addEventListener('input', () => {
      this.autoResizeTextarea(input);
    });

    // Enter to submit (Shift+Enter for newline)
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form?.dispatchEvent(new Event('submit'));
      }
    });

    // Quick prompt chips
    document.querySelectorAll('.tutor-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const promptText = chip.dataset.prompt;
        if (input) {
          input.value = promptText;
          input.focus();
          this.autoResizeTextarea(input);
        }
      });
    });

    // Clear context button
    document.getElementById('btn-clear-tutor-context')?.addEventListener('click', () => {
      this.clearContextDocument();
    });

    // Clear chat button
    document.getElementById('btn-clear-tutor-chat')?.addEventListener('click', () => {
      if (confirm('¿Deseas reiniciar la conversación con el Tutor IA?')) {
        this.messages = [];
        this.loadInitialGreeting();
      }
    });
  }

  autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }

  loadInitialGreeting() {
    const chatContainer = document.getElementById('tutor-messages-container');
    if (!chatContainer) return;
    chatContainer.innerHTML = '';

    const greeting = {
      role: 'model',
      text: `👋 **¡Hola! Soy tu Tutor IA de FlojerApp.**

Estoy conectado a **Google Gemini** para ayudarte a dominar cualquier materia, resolver dudas de tus clases o analizar tus lecturas.

✨ **¿Qué podemos hacer juntos?**
* **Preguntarme cualquier duda conceptual** de tus clases o apuntes.
* **Analizar lecturas:** Carga un PDF en la pestaña de *Visor PDF*, destaca texto y pulsa *"Preguntar al Tutor"*.
* **Pedirme casos prácticos o analogías:** Pruébalo con los botones rápidos de abajo.
* **Evaluación socrática:** Pídeme que te haga preguntas sorpresa para verificar lo aprendido.

¿Qué tema estás estudiando hoy?`,
      timestamp: new Date()
    };

    this.messages = [greeting];
    this.renderMessage(greeting);
  }

  updateStatusBanner() {
    const banner = document.getElementById('tutor-api-status-pill');
    if (!banner) return;
    const hasKey = window.geminiService.hasApiKey();
    const model = window.geminiService.getModel();

    if (hasKey) {
      banner.className = 'status-pill status-pill-active';
      banner.innerHTML = `🟢 Gemini Conectado (${model})`;
      banner.title = 'API Key activa y lista para responder';
    } else {
      banner.className = 'status-pill status-pill-warn cursor-pointer';
      banner.innerHTML = `🟡 Sin API Key (Modo Demo) - Clic para configurar`;
      banner.title = 'Haz clic para ingresar tu clave gratuita de Google Gemini';
      banner.onclick = () => window.app.openSettingsModal();
    }
  }

  setContextDocument(text) {
    this.contextDocument = text;
    const badge = document.getElementById('tutor-context-badge');
    const preview = document.getElementById('tutor-context-preview');
    if (badge) badge.classList.remove('hidden');
    if (preview) {
      preview.textContent = text.length > 80 ? text.slice(0, 80) + '...' : text;
    }
  }

  clearContextDocument() {
    this.contextDocument = '';
    const badge = document.getElementById('tutor-context-badge');
    if (badge) badge.classList.add('hidden');
    window.app.showToast('Contexto de documento desvinculado.', 'info');
  }

  injectContextAndPrompt(promptText) {
    const input = document.getElementById('tutor-input');
    if (input) {
      input.value = promptText;
      this.autoResizeTextarea(input);
      input.focus();
    }
  }

  async sendUserMessage(text) {
    const userMsg = {
      role: 'user',
      text,
      timestamp: new Date()
    };
    this.messages.push(userMsg);
    this.renderMessage(userMsg);

    // Scroll to bottom
    this.scrollToBottom();

    // Show typing loader
    this.showTypingIndicator();
    this.isGenerating = true;

    try {
      const replyText = await window.geminiService.chatMessage(
        text,
        this.messages.slice(0, -1),
        this.contextDocument
      );

      this.hideTypingIndicator();
      this.isGenerating = false;

      const modelMsg = {
        role: 'model',
        text: replyText,
        timestamp: new Date()
      };
      this.messages.push(modelMsg);
      this.renderMessage(modelMsg);
      this.scrollToBottom();

    } catch (e) {
      this.hideTypingIndicator();
      this.isGenerating = false;
      console.error(e);

      const errorMsg = {
        role: 'model',
        text: `⚠️ **Ocurrió un error al contactar a Google Gemini:**\n\n\`${e.message}\`\n\nPor favor verifica tu conexión o tu API Key en el menú de Configuración (⚙️).`,
        timestamp: new Date()
      };
      this.renderMessage(errorMsg);
      this.scrollToBottom();
    }
  }

  renderMessage(msg) {
    const container = document.getElementById('tutor-messages-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = `chat-message-row chat-message-${msg.role}`;

    const avatar = msg.role === 'user' ? '👤' : '🤖';
    const roleTitle = msg.role === 'user' ? 'Tú' : 'Tutor IA';

    // Parse Markdown safely
    let formattedHtml = msg.text;
    if (window.marked) {
      try {
        formattedHtml = window.marked.parse(msg.text);
      } catch (err) {
        formattedHtml = msg.text.replace(/\n/g, '<br>');
      }
    } else {
      formattedHtml = msg.text.replace(/\n/g, '<br>');
    }

    const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    row.innerHTML = `
      <div class="chat-avatar">${avatar}</div>
      <div class="chat-bubble">
        <div class="chat-bubble-header">
          <span class="chat-sender-name">${roleTitle}</span>
          <span class="chat-time">${timeStr}</span>
        </div>
        <div class="chat-bubble-content markdown-body">${formattedHtml}</div>
        ${msg.role === 'model' ? `
          <div class="chat-bubble-actions">
            <button class="chat-action-btn" title="Escuchar respuesta (Voz)" onclick="window.tutorModule.speakText(this)">
              🔊 Escuchar
            </button>
            <button class="chat-action-btn" title="Copiar texto" onclick="window.tutorModule.copyText(this)">
              📋 Copiar
            </button>
            <button class="chat-action-btn" title="Crear Flashcard de esta explicación" onclick="window.tutorModule.createCardFromReply(this)">
              🗂️ A Flashcard
            </button>
          </div>
        ` : ''}
      </div>
    `;

    // Store raw text in DOM element for easy actions
    row.dataset.rawText = msg.text;

    container.appendChild(row);
  }

  showTypingIndicator() {
    const container = document.getElementById('tutor-messages-container');
    if (!container) return;
    const loader = document.createElement('div');
    loader.id = 'tutor-typing-indicator';
    loader.className = 'chat-message-row chat-message-model';
    loader.innerHTML = `
      <div class="chat-avatar">🤖</div>
      <div class="chat-bubble typing-bubble">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-text">Pensando respuesta con Gemini...</span>
      </div>
    `;
    container.appendChild(loader);
  }

  hideTypingIndicator() {
    const loader = document.getElementById('tutor-typing-indicator');
    loader?.remove();
  }

  scrollToBottom() {
    const container = document.getElementById('tutor-messages-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  speakText(btn) {
    if (!('speechSynthesis' in window)) {
      window.app.showToast('Tu navegador no soporta síntesis de voz.', 'warning');
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      btn.innerHTML = '🔊 Escuchar';
      return;
    }

    const row = btn.closest('.chat-message-row');
    const rawText = row?.dataset?.rawText || '';
    // Strip markdown symbols for natural speech
    const cleanSpeech = rawText.replace(/[*#`_~>\[\]\(\)]/g, ' ');

    this.speechUtterance = new SpeechSynthesisUtterance(cleanSpeech);
    this.speechUtterance.lang = 'es-ES';
    this.speechUtterance.rate = 1.05;

    this.speechUtterance.onstart = () => {
      btn.innerHTML = '⏹️ Detener';
    };
    this.speechUtterance.onend = () => {
      btn.innerHTML = '🔊 Escuchar';
    };
    this.speechUtterance.onerror = () => {
      btn.innerHTML = '🔊 Escuchar';
    };

    window.speechSynthesis.speak(this.speechUtterance);
  }

  copyText(btn) {
    const row = btn.closest('.chat-message-row');
    const rawText = row?.dataset?.rawText || '';
    navigator.clipboard.writeText(rawText).then(() => {
      window.app.showToast('Texto copiado al portapapeles.', 'success');
      btn.textContent = '✅ Copiado';
      setTimeout(() => { btn.textContent = '📋 Copiar'; }, 2000);
    }).catch(() => {
      window.app.showToast('No se pudo copiar.', 'warning');
    });
  }

  createCardFromReply(btn) {
    const row = btn.closest('.chat-message-row');
    const rawText = row?.dataset?.rawText || '';
    window.app.switchTab('flashcards');
    window.flashcardsModule.openCreateModalWithText(rawText);
  }
}

window.tutorModule = new TutorModule();
