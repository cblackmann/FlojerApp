/**
 * Main Application Orchestrator - FlojerApp
 */
class FlojerApp {
  constructor() {
    this.currentTab = 'calendario';
    this.toastTimeout = null;
  }

  init() {
    this.applyTheme();
    this.bindNavigation();
    this.bindSettings();
    this.bindModals();
    this.bindFloatingTutor();

    // Initialize individual modules
    if (window.calendarModule) window.calendarModule.init();
    if (window.pdfViewerModule) window.pdfViewerModule.init();
    if (window.tutorModule) window.tutorModule.init();
    if (window.flashcardsModule) window.flashcardsModule.init();
    if (window.quizModule) window.quizModule.init();

    // Check query params if any
    const hash = window.location.hash.replace('#', '');
    if (['calendario', 'pdf', 'tutor', 'flashcards', 'quiz'].includes(hash)) {
      this.switchTab(hash);
    }
  }

  bindNavigation() {
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Theme toggle
    document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Settings button
    document.getElementById('btn-open-settings')?.addEventListener('click', () => {
      this.openSettingsModal();
    });
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    window.location.hash = tabName;

    // Update nav buttons
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tabName}`);
    });

    // If PDF tab selected, trigger page re-render if loaded
    if (tabName === 'pdf' && window.pdfViewerModule && window.pdfViewerModule.pdfDoc) {
      window.pdfViewerModule.renderPage(window.pdfViewerModule.pageNum);
    }
  }

  bindFloatingTutor() {
    const floatBtn = document.getElementById('floating-tutor-btn');
    floatBtn?.addEventListener('click', () => {
      this.switchTab('tutor');
    });
  }

  bindModals() {
    // Backdrop click and close buttons
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal.id);
        }
      });

      modal.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.closeModal(modal.id);
        });
      });
    });

    // Escape key closes modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
          modal.classList.remove('active');
        });
      }
    });
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  openSettingsModal() {
    const modal = document.getElementById('modal-settings');
    const settings = window.appStorage.getSettings();

    document.getElementById('settings-api-key').value = settings.apiKey || '';
    document.getElementById('settings-model').value = settings.geminiModel || 'gemini-2.5-flash';
    document.getElementById('settings-sound').checked = settings.soundEnabled !== false;

    modal.classList.add('active');
  }

  bindSettings() {
    // Save settings
    document.getElementById('form-settings')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const apiKey = document.getElementById('settings-api-key').value.trim();
      const geminiModel = document.getElementById('settings-model').value;
      const soundEnabled = document.getElementById('settings-sound').checked;

      const current = window.appStorage.getSettings();
      current.apiKey = apiKey;
      current.geminiModel = geminiModel;
      current.soundEnabled = soundEnabled;

      window.appStorage.saveSettings(current);
      this.closeModal('modal-settings');
      this.showToast('Configuración guardada correctamente.', 'success');

      if (window.tutorModule) window.tutorModule.updateStatusBanner();
    });

    // Test API key button
    document.getElementById('btn-test-api-key')?.addEventListener('click', async () => {
      const apiKey = document.getElementById('settings-api-key').value.trim();
      const model = document.getElementById('settings-model').value;
      const statusEl = document.getElementById('api-key-test-status');

      if (!apiKey) {
        statusEl.innerHTML = '<span class="text-red">Ingresa una clave primero.</span>';
        return;
      }

      statusEl.innerHTML = '<span>⏳ Conectando con Google Gemini...</span>';
      try {
        await window.geminiService.testApiKey(apiKey, model);
        statusEl.innerHTML = '<span class="text-green">✅ ¡Conexión exitosa! Clave válida.</span>';
      } catch (err) {
        statusEl.innerHTML = `<span class="text-red">❌ Error: ${err.message}</span>`;
      }
    });

    // Export Data Backup
    document.getElementById('btn-export-backup')?.addEventListener('click', () => {
      const json = window.appStorage.exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FlojerApp_Backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Respaldo descargado.', 'success');
    });

    // Import Data Backup
    const fileImport = document.getElementById('input-import-backup');
    document.getElementById('btn-import-backup')?.addEventListener('click', () => {
      fileImport?.click();
    });

    fileImport?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const ok = window.appStorage.importAllData(evt.target.result);
        if (ok) {
          this.showToast('¡Datos restaurados con éxito! Recargando...', 'success');
          setTimeout(() => window.location.reload(), 1200);
        } else {
          this.showToast('Error al importar el archivo JSON.', 'danger');
        }
      };
      reader.readAsText(file);
    });
  }

  toggleTheme() {
    const settings = window.appStorage.getSettings();
    const newTheme = settings.theme === 'light' ? 'dark' : 'light';
    settings.theme = newTheme;
    window.appStorage.saveSettings(settings);
    this.applyTheme();
  }

  applyTheme() {
    const settings = window.appStorage.getSettings();
    const isLight = settings.theme === 'light';
    document.documentElement.classList.toggle('light-theme', isLight);
    const themeBtn = document.getElementById('btn-toggle-theme');
    if (themeBtn) {
      themeBtn.innerHTML = isLight ? '🌙' : '☀️';
      themeBtn.title = isLight ? 'Modo Oscuro' : 'Modo Claro';
    }
  }

  showToast(message, type = 'info', duration = 4000) {
    const toast = document.getElementById('app-toast');
    if (!toast) return;

    if (this.toastTimeout) clearTimeout(this.toastTimeout);

    toast.className = `toast-notification toast-${type} active`;
    toast.innerHTML = `
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.classList.remove('active')">&times;</button>
    `;

    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('active');
    }, duration);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new FlojerApp();
  window.app.init();
});
