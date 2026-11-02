/**
 * SM-2 (SuperMemo-2 Enhanced) Spaced Repetition Algorithm
 * Algoritmo científico de retención de memoria y repetición espaciada
 */
export const SRS_GRADES = {
  AGAIN: 1, // Fallo / Ni idea (Reset)
  HARD: 2,  // Difícil (Mucho esfuerzo)
  GOOD: 3,  // Bueno (Esfuerzo estándar / Éxito)
  EASY: 4   // Fácil (Dominio instantáneo)
};

export class SRSEngine {
  /**
   * Calcula el siguiente estado y fecha de revisión para una tarjeta
   * @param {Object} card Datos actuales de la tarjeta (intervalo, repeticiones, facilidad, etc.)
   * @param {number} grade Calificación de 1 a 4 (AGAIN, HARD, GOOD, EASY)
   * @returns {Object} Valores actualizados para persistir en la base de datos
   */
  static calculateNextReview(card, grade) {
    const currentInterval = card.intervalo || 1;
    const currentRepetitions = card.repeticiones || 0;
    let easeFactor = parseFloat(card.facilidad) || 2.50;

    let nextInterval = 1;
    let nextRepetitions = currentRepetitions;
    let nextState = card.estado || 'learning';

    // Mapeo de escala interna de 1-4 a escala estándar SM-2 de 0-5
    // 1 -> 1 (Fallo total)
    // 2 -> 3 (Acierto difícil)
    // 3 -> 4 (Acierto bueno)
    // 4 -> 5 (Acierto perfecto)
    const sm2ScoreMap = { 1: 1, 2: 3, 3: 4, 4: 5 };
    const q = sm2ScoreMap[grade] || 3;

    // Actualización del Factor de Facilidad (Ease Factor):
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    
    // El Ease Factor nunca desciende por debajo de 1.30 (límite de SuperMemo)
    if (easeFactor < 1.30) {
      easeFactor = 1.30;
    }
    // Redondear a 2 decimales
    easeFactor = Math.round(easeFactor * 100) / 100;

    if (grade === SRS_GRADES.AGAIN) {
      // Fallo de memoria: reset de repeticiones e intervalo mínimo
      nextRepetitions = 0;
      nextInterval = 1;
      nextState = 'learning';
    } else {
      // Repaso exitoso (HARD, GOOD o EASY)
      if (currentRepetitions === 0) {
        nextInterval = 1; // 1 día
        nextRepetitions = 1;
      } else if (currentRepetitions === 1) {
        nextInterval = grade === SRS_GRADES.HARD ? 3 : 6; // 3 o 6 días
        nextRepetitions = 2;
      } else {
        // I(n) = I(n-1) * EF
        let multiplier = easeFactor;
        if (grade === SRS_GRADES.HARD) {
          multiplier = 1.2; // Progresión más lenta para tarjetas difíciles
        } else if (grade === SRS_GRADES.EASY) {
          multiplier = easeFactor * 1.3; // Bonificación fácil
        }
        nextInterval = Math.round(currentInterval * multiplier);
        nextRepetitions = currentRepetitions + 1;
      }

      // Clasificación de estado
      if (nextInterval >= 30 && nextRepetitions >= 4) {
        nextState = 'mastered';
      } else {
        nextState = 'review';
      }
    }

    // Cálculo de la próxima fecha de revisión en milisegundos
    const now = new Date();
    const nextReviewDate = new Date(now.getTime() + (nextInterval * 24 * 60 * 60 * 1000));

    return {
      intervalo: nextInterval,
      repeticiones: nextRepetitions,
      facilidad: easeFactor,
      proxima_revision: nextReviewDate.toISOString(),
      estado: nextState,
      ultima_calificacion: grade,
      ultimo_repaso: now.toISOString()
    };
  }

  /**
   * Determina si una tarjeta está vencida para estudio hoy
   */
  static isCardDue(card) {
    if (!card.proxima_revision) return true;
    const dueDate = new Date(card.proxima_revision);
    const now = new Date();
    return dueDate <= now;
  }

  /**
   * Obtiene una etiqueta legible para el intervalo estimado
   */
  static formatIntervalLabel(days) {
    if (days <= 1) return '1 día';
    if (days < 30) return `${days} días`;
    const months = Math.round(days / 30);
    return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  }
}
