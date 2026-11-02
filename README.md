# FlojerApp - Aplicación de Estudio Inteligente

Una plataforma moderna, integral y rápida para estudiantes, diseñada para maximizar el rendimiento académico mediante técnicas de estudio activo, repetición espaciada y el poder de **Google Gemini**.

---

## 🚀 Funcionalidades Principales

### 1. 📅 Calendario con Notificaciones
- **Vista mensual interactiva:** Visualiza tus sesiones de estudio, fechas de certámenes, entregas y repasos diarios.
- **Categorización por colores:** Exámenes (rojo), Sesiones de estudio (azul), Repasos SRS (verde), y Entregas (amarillo).
- **Notificaciones de escritorio y sonoras:** Integración con la *Web Notifications API* y alertas Web Audio para avisarte con la anticipación que elijas (15 min, 30 min, 1 hora, 1 día antes).

### 2. 📖 Visor de PDF con Destacador Interactivo
- **Renderizado de alto rendimiento:** Basado en PDF.js con soporte HiDPI para lectura nítida de presentaciones, libros y apuntes.
- **Destacador con 4 colores:** Resalta texto con paleta pastel (amarillo, verde lima, celeste y rosa).
- **Menú flotante contextual:** Al seleccionar cualquier fragmento de texto con el cursor, puedes:
  - 🖍️ **Destacar** y guardar en tu lista lateral de apuntes.
  - 🤖 **Preguntar al Tutor IA** para que te explique el fragmento inmediatamente.
  - 🗂️ **Crear Flashcard** basada en ese extracto.
  - 📝 **Crear Pregunta de Quiz** para evaluar tu retención.
- **Panel lateral de apuntes:** Accede a todos los textos destacados del documento con salto directo a la página correspondiente con un clic.

### 3. 🤖 Tutor IA (Conectado a Google Gemini)
- **Modelos compatibles:** Soporta los modelos más veloces y actualizados de Google (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`).
- **Inyección de contexto:** Permite vincular la página actual del PDF o fragmentos de clases para que el tutor responda con base estricta en tu material de estudio.
- **Chips de interacción pedagógica rápida:**
  - *Método Feynman*: Explicaciones en lenguaje sencillo y analógico.
  - *Casos clínicos y prácticos*: Aplicación directa de la teoría.
  - *Preguntas socráticas*: Evaluación de comprensión.
  - *Mnemotecnias y resúmenes de alto rendimiento*.
- **Síntesis de voz (Text-to-Speech):** Escucha las respuestas del tutor mientras descansas la vista.

### 4. 🗂️ Creador de Flashcards (Repetición Espaciada - SRS)
- **Generador con IA:** Escribe cualquier tema o pega tus apuntes y Gemini creará automáticamente las tarjetas con anverso, reverso pedagógico y pistas mnemotécnicas.
- **Creador manual:** Añade tarjetas personalizadas a tus propios mazos.
- **Modo Estudio 3D:**
  - Animación de volteo de tarjeta con un clic o presionando la tecla `Espacio`.
  - Botones de autoevaluación SRS:
    - 🔴 **Difícil** (Atajo: `1`) - Reinserta la tarjeta para repasarla pronto.
    - 🟡 **Regular** (Atajo: `2`) - Mantiene en revisión.
    - 🟢 **Dominada** (Atajo: `3`) - Marca como dominada.
  - Barra de progreso, métricas de retención y celebración con confeti al finalizar.

### 5. 📝 Creador de Preguntas de Selección Múltiple (Quiz)
- **Generación automática con Gemini:** Crea exámenes simulados de 4 opciones (A, B, C, D) con enunciado riguroso y retroalimentación académica.
- **Simulador de examen interactivo:**
  - Selección de opciones con verificación instantánea (verde para correcta, rojo para error).
  - Caja de retroalimentación detallada explicando por qué la opción es la acertada y el fallo de las distractoras.
  - Pantalla final de métricas con porcentaje de acierto.
  - **Función de oro:** Botón para *convertir automáticamente todas las preguntas falladas en Flashcards* de refuerzo.

---

## 💻 Cómo Iniciar la Aplicación

No requiere instalaciones complejas ni dependencias de Node.js o Python:

1. Haz doble clic en el archivo **`abrir_app.bat`** (o abre directamente **`index.html`** en tu navegador favorito como Google Chrome o Microsoft Edge).
2. Para conectar el Tutor IA y los generadores automáticos, ve al botón de **⚙️ Configuración** arriba a la derecha e introduce tu **Google Gemini API Key** (puedes obtenerla gratis en [Google AI Studio](https://aistudio.google.com/app/apikey)).
3. ¡Listo para estudiar!
