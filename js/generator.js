/**
 * Gemini Question Bank Generator UI Module
 */
import { db } from './db.js';
import { gemini } from './gemini.js';

export class GeneratorModule {
  constructor(containerElement, onSavedCallback) {
    this.container = containerElement;
    this.onSavedCallback = onSavedCallback;
    this.previewCards = [];
  }

  async render() {
    const folders = await db.getFolders();

    this.container.innerHTML = `
      <div class="max-w-3xl mx-auto space-y-6">
        
        <div class="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 md:p-8 shadow-xl">
          <div class="flex items-center gap-3 mb-2">
            <span class="text-3xl">✨</span>
            <div>
              <h2 class="text-xl font-bold text-slate-100">Generador de Preguntas con Gemini API</h2>
              <p class="text-xs text-slate-400">Genera preguntas de selección múltiple con salida JSON Schema estricta para tu base de datos.</p>
            </div>
          </div>

          <form id="form-generator" class="space-y-4 mt-6">
            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Carpeta / Asignatura de Destino
              </label>
              <select id="gen-folder-select" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition">
                ${folders.map(f => `<option value="${f.id}">${f.icon} ${f.title}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Pega tus apuntes, transcripción o resumen de la clase *
              </label>
              <textarea id="gen-notes-input" rows="6" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition font-sans leading-relaxed" placeholder="Pega aquí párrafos de tu clase, guía o temario (ej: fisiopatología cardiovascular, leyes de Newton, farmacología...)" required></textarea>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Cantidad de Preguntas
                </label>
                <select id="gen-count-select" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition">
                  <option value="3">3 preguntas rápidas</option>
                  <option value="5" selected>5 preguntas clave</option>
                  <option value="8">8 preguntas completas</option>
                  <option value="12">12 preguntas (Examen)</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Nivel de Dificultad
                </label>
                <select id="gen-difficulty-select" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition">
                  <option value="básico">Básico (Conceptos y definiciones)</option>
                  <option value="intermedio" selected>Intermedio (Razonamiento y aplicación)</option>
                  <option value="avanzado">Avanzado (Casos clínicos y deducción)</option>
                </select>
              </div>
            </div>

            <button type="submit" id="btn-submit-gen" class="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2">
              <span>✨ Generar Banco de Preguntas</span>
            </button>
          </form>
        </div>

        <!-- Vista Previa de Preguntas Generadas -->
        <div id="gen-preview-section" class="hidden space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>📋</span> Vista Previa de Preguntas Generadas (<span id="preview-count">0</span>)
            </h3>
            <button id="btn-save-all-generated" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center gap-2">
              <span>💾 Guardar Todo en la Base de Datos</span>
            </button>
          </div>

          <div id="gen-preview-cards-list" class="space-y-4">
            <!-- Cards rendered here -->
          </div>
        </div>

      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const form = this.container.querySelector('#form-generator');
    const btnSubmit = this.container.querySelector('#btn-submit-gen');

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = this.container.querySelector('#gen-notes-input').value.trim();
      const count = parseInt(this.container.querySelector('#gen-count-select').value, 10);
      const difficulty = this.container.querySelector('#gen-difficulty-select').value;
      const folderId = this.container.querySelector('#gen-folder-select').value;

      if (!text) return;

      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Generando con Gemini Structured Outputs...</span>
      `;

      try {
        const questions = await gemini.generateQuestionBank(text, count, difficulty);
        this.previewCards = questions.map(q => ({ ...q, folder_id: folderId }));
        this.renderPreview();
      } catch (err) {
        alert('Error al generar preguntas: ' + err.message);
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<span>✨ Generar Banco de Preguntas</span>`;
      }
    });

    this.container.querySelector('#btn-save-all-generated')?.addEventListener('click', async () => {
      if (this.previewCards.length === 0) return;
      await db.saveBatchCards(this.previewCards);
      alert(`¡Se han guardado ${this.previewCards.length} preguntas en tu base de datos!`);
      if (this.onSavedCallback) this.onSavedCallback();
    });
  }

  renderPreview() {
    const previewSection = this.container.querySelector('#gen-preview-section');
    const previewList = this.container.querySelector('#gen-preview-cards-list');
    const previewCount = this.container.querySelector('#preview-count');

    previewCount.textContent = this.previewCards.length;
    previewSection.classList.remove('hidden');

    const letters = ['A', 'B', 'C', 'D'];

    previewList.innerHTML = this.previewCards.map((card, idx) => `
      <div class="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg relative group">
        <button data-remove-idx="${idx}" class="btn-remove-preview absolute top-4 right-4 text-xs text-slate-500 hover:text-rose-400 p-1">
          ✕ Quitar
        </button>

        <span class="text-xs font-bold text-indigo-400 uppercase tracking-wider block mb-2">
          Pregunta ${idx + 1} • ${card.etiquetas?.join(', ') || 'General'}
        </span>

        <h4 class="text-base font-bold text-slate-100 mb-3 leading-snug">
          ${card.pregunta}
        </h4>

        <div class="space-y-1.5 mb-3">
          ${card.opciones.map((opt, optIdx) => `
            <div class="text-xs px-3 py-2 rounded-lg border ${optIdx === card.respuesta_correcta ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200 font-semibold' : 'bg-slate-900/40 border-slate-700/60 text-slate-300'} flex items-center gap-2">
              <span class="font-bold">${letters[optIdx]}.</span>
              <span>${opt}</span>
              ${optIdx === card.respuesta_correcta ? '<span class="ml-auto text-emerald-400 text-[10px] uppercase font-bold">✓ Correcta</span>' : ''}
            </div>
          `).join('')}
        </div>

        <div class="text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-700/40 whitespace-pre-line leading-relaxed">
          <strong class="text-indigo-300">Explicación:</strong>\n${card.explicacion_detallada}
        </div>
      </div>
    `).join('');

    // Remove single card button
    previewList.querySelectorAll('.btn-remove-preview').forEach(btn => {
      btn.addEventListener('click', () => {
        const removeIdx = parseInt(btn.dataset.removeIdx, 10);
        this.previewCards.splice(removeIdx, 1);
        this.renderPreview();
      });
    });

    previewSection.scrollIntoView({ behavior: 'smooth' });
  }
}
