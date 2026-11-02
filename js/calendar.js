/**
 * Calendar & Notification Module
 */
class CalendarModule {
  constructor() {
    this.currentDate = new Date();
    this.selectedDate = new Date();
    this.audioAlert = null;
    this.checkInterval = null;
  }

  init() {
    this.setupAudio();
    this.bindEvents();
    this.render();
    this.startNotificationEngine();
  }

  setupAudio() {
    // Elegant Web Audio API chime (zero external sound file needed)
    this.playChime = () => {
      try {
        const settings = window.appStorage.getSettings();
        if (!settings.soundEnabled) return;
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      } catch (e) {
        console.warn('Audio chime not available', e);
      }
    };
  }

  bindEvents() {
    document.getElementById('cal-prev-btn')?.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.render();
    });

    document.getElementById('cal-next-btn')?.addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.render();
    });

    document.getElementById('cal-today-btn')?.addEventListener('click', () => {
      this.currentDate = new Date();
      this.selectedDate = new Date();
      this.render();
    });

    document.getElementById('btn-add-event-modal')?.addEventListener('click', () => {
      this.openAddEventModal();
    });

    document.getElementById('form-add-event')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveEvent();
    });

    document.getElementById('btn-request-notif')?.addEventListener('click', () => {
      this.requestNotificationPermission();
    });
  }

  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      window.app.showToast('Tu navegador no soporta notificaciones de escritorio.', 'warning');
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        window.app.showToast('¡Notificaciones activadas con éxito!', 'success');
        this.playChime();
        new Notification('FlojerApp - Notificaciones Activas', {
          body: 'Te avisaremos puntualmente de tus sesiones de estudio y exámenes.',
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236366f1"><path d="M12 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 5 14h14a1 1 0 0 0 .707-1.707L19 11.586V8a6 6 0 0 0-6-6zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3z"/></svg>'
        });
      } else {
        window.app.showToast('Permiso de notificaciones denegado.', 'info');
      }
      this.updateNotifStatusBadge();
    } catch (e) {
      console.error(e);
    }
  }

  updateNotifStatusBadge() {
    const badge = document.getElementById('notif-permission-badge');
    if (!badge) return;
    if (!('Notification' in window)) {
      badge.textContent = 'No soportadas';
      badge.className = 'badge badge-gray';
      return;
    }
    if (Notification.permission === 'granted') {
      badge.innerHTML = '🔔 Notificaciones Activas';
      badge.className = 'badge badge-green';
    } else if (Notification.permission === 'denied') {
      badge.innerHTML = '🔕 Bloqueadas por el navegador';
      badge.className = 'badge badge-red';
    } else {
      badge.innerHTML = '⚠️ Haz clic para activar alertas';
      badge.className = 'badge badge-amber cursor-pointer';
    }
  }

  startNotificationEngine() {
    this.updateNotifStatusBadge();
    // Check every 30 seconds
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = setInterval(() => this.checkUpcomingEvents(), 30000);
    // Initial check
    this.checkUpcomingEvents();
  }

  checkUpcomingEvents() {
    const events = window.appStorage.getEvents();
    const now = new Date();
    let updated = false;

    events.forEach(evt => {
      if (evt.notified) return;
      if (!evt.date || !evt.time) return;

      const eventDateTime = new Date(`${evt.date}T${evt.time}:00`);
      const diffMs = eventDateTime - now;
      const diffMinutes = diffMs / (1000 * 60);

      const reminderThreshold = evt.reminderMinutes || 30;

      // Notify if within the reminder window and not yet passed more than 5 minutes ago
      if (diffMinutes <= reminderThreshold && diffMinutes >= -5) {
        evt.notified = true;
        updated = true;
        this.fireNotification(evt, diffMinutes);
      }
    });

    if (updated) {
      window.appStorage.saveEvents(events);
      this.renderEventList();
    }
  }

  fireNotification(evt, minutesRemaining) {
    this.playChime();
    const timeText = minutesRemaining > 0 
      ? `Comienza en aproximadamente ${Math.round(minutesRemaining)} minutos` 
      : '¡Está comenzando ahora mismo!';

    const title = `Recordatorio: ${evt.title}`;
    const body = `${timeText} (${evt.time} hrs). Cita: [${evt.category.toUpperCase()}]\n${evt.notes || ''}`;

    window.app.showToast(`🔔 ${title} - ${timeText}`, 'info', 8000);

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          tag: evt.id
        });
      } catch (e) {
        console.error('Desktop notification failed', e);
      }
    }
  }

  render() {
    this.renderMonthHeader();
    this.renderCalendarGrid();
    this.renderEventList();
    this.updateNotifStatusBadge();
  }

  renderMonthHeader() {
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const el = document.getElementById('cal-month-title');
    if (el) {
      el.textContent = `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
    }
  }

  renderCalendarGrid() {
    const grid = document.getElementById('cal-days-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    // Adjust for Monday as first day of week (0: Mon ... 6: Sun)
    const startOffset = (firstDayIndex === 0 ? 6 : firstDayIndex - 1);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const todayStr = new Date().toISOString().split('T')[0];
    const selectedStr = this.selectedDate.toISOString().split('T')[0];
    const allEvents = window.appStorage.getEvents();

    // Previous month filler days
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell cal-day-other';
      cell.innerHTML = `<span class="day-num">${dayNum}</span>`;
      grid.appendChild(cell);
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const monthPadded = String(month + 1).padStart(2, '0');
      const dayPadded = String(day).padStart(2, '0');
      const dateStr = `${year}-${monthPadded}-${dayPadded}`;

      const cell = document.createElement('div');
      cell.className = 'cal-day-cell';
      if (dateStr === todayStr) cell.classList.add('cal-day-today');
      if (dateStr === selectedStr) cell.classList.add('cal-day-selected');

      const dayEvents = allEvents.filter(e => e.date === dateStr);
      let dotsHtml = '';
      if (dayEvents.length > 0) {
        dotsHtml = `
          <div class="day-events-dots">
            ${dayEvents.slice(0, 3).map(e => `<span class="event-dot dot-${e.category}"></span>`).join('')}
            ${dayEvents.length > 3 ? `<span class="more-dots">+${dayEvents.length - 3}</span>` : ''}
          </div>
        `;
      }

      cell.innerHTML = `
        <span class="day-num">${day}</span>
        ${dotsHtml}
      `;

      cell.addEventListener('click', () => {
        this.selectedDate = new Date(year, month, day);
        this.renderCalendarGrid();
        this.renderEventList();
      });

      grid.appendChild(cell);
    }
  }

  renderEventList() {
    const listEl = document.getElementById('cal-events-list');
    const selectedDateTitle = document.getElementById('cal-selected-date-text');
    if (!listEl) return;

    const selectedStr = this.selectedDate.toISOString().split('T')[0];
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    if (selectedDateTitle) {
      selectedDateTitle.textContent = this.selectedDate.toLocaleDateString('es-ES', options);
    }

    const allEvents = window.appStorage.getEvents();
    const dayEvents = allEvents.filter(e => e.date === selectedStr);

    if (dayEvents.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state-mini">
          <span class="empty-icon">📅</span>
          <p>No hay eventos programados para este día.</p>
          <button class="btn btn-secondary btn-sm" onclick="window.calendarModule.openAddEventModal('${selectedStr}')">
            + Agendar sesión o examen
          </button>
        </div>
      `;
      return;
    }

    listEl.innerHTML = dayEvents.map(evt => {
      const categoryLabels = {
        examen: 'Examen 🎯',
        estudio: 'Sesión de Estudio 📚',
        repaso: 'Repaso SRS 🔄',
        entrega: 'Entrega / Tarea 📌'
      };

      return `
        <div class="event-card event-border-${evt.category}">
          <div class="event-info">
            <div class="event-header-row">
              <span class="badge badge-${evt.category}">${categoryLabels[evt.category] || evt.category}</span>
              <span class="event-time">⏰ ${evt.time || 'Sin hora'}</span>
            </div>
            <h4 class="event-title">${evt.title}</h4>
            ${evt.notes ? `<p class="event-notes">${evt.notes}</p>` : ''}
            <div class="event-meta">
              <span>🔔 Recordar: ${evt.reminderMinutes} min antes</span>
              ${evt.notified ? '<span class="badge badge-gray text-xs">Aviso enviado</span>' : ''}
            </div>
          </div>
          <div class="event-actions">
            <button class="icon-btn-danger" title="Eliminar evento" onclick="window.calendarModule.deleteEvent('${evt.id}')">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  openAddEventModal(defaultDate = null) {
    const modal = document.getElementById('modal-event');
    const dateInput = document.getElementById('event-date');
    if (defaultDate) {
      dateInput.value = defaultDate;
    } else {
      dateInput.value = this.selectedDate.toISOString().split('T')[0];
    }
    modal.classList.add('active');
  }

  handleSaveEvent() {
    const title = document.getElementById('event-title').value.trim();
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    const category = document.getElementById('event-category').value;
    const reminderMinutes = parseInt(document.getElementById('event-reminder').value, 10);
    const notes = document.getElementById('event-notes').value.trim();

    if (!title || !date || !time) {
      window.app.showToast('Por favor completa el título, fecha y hora.', 'warning');
      return;
    }

    const newEvent = {
      id: 'evt_' + Date.now(),
      title,
      date,
      time,
      category,
      reminderMinutes: isNaN(reminderMinutes) ? 30 : reminderMinutes,
      notes,
      notified: false
    };

    window.appStorage.addEvent(newEvent);
    window.app.closeModal('modal-event');
    document.getElementById('form-add-event').reset();
    window.app.showToast('Evento agendado exitosamente.', 'success');
    this.render();
  }

  deleteEvent(id) {
    if (confirm('¿Deseas eliminar este evento del calendario?')) {
      window.appStorage.deleteEvent(id);
      window.app.showToast('Evento eliminado.', 'info');
      this.render();
    }
  }
}

window.calendarModule = new CalendarModule();
