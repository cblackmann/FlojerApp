# FlojerApp - Progressive Web App (PWA) de Estudio Activo & Retención Mnemotécnica

Arquitectura modular de alto rendimiento para Active Recall y Repetición Espaciada (Spaced Repetition) con generación inteligente asistida por **Google Gemini API** (Structured Outputs) y persistencia híbrida (IndexedDB local + Supabase DDL).

---

## 🏗️ 1. Arquitectura del Sistema

```
                     +---------------------------------------+
                     |         FlojerApp PWA (Client)        |
                     |   (Vanilla JS ES6 + Tailwind CSS JIT) |
                     +-------------------+-------------------+
                                         |
            +----------------------------+----------------------------+
            |                                                         |
            v                                                         v
+-----------------------+                                 +-----------------------+
|  Local Storage Engine |                                 |  Google Gemini API    |
|   (IndexedDB W3C)     |                                 | (Structured Outputs)  |
| - folders, cards      |                                 | - responseSchema      |
| - reviews_log         |                                 | - gemini-2.5-pro/flash|
| - user_metrics        |                                 +-----------------------+
+-----------+-----------+
            | (Opcional)
            v
+-----------------------+
|  Supabase Cloud Sync  |
| (PostgreSQL + RLS DDL)|
+-----------------------+
```

---

## 📁 2. Estructura de Archivos del Proyecto

```
FlojerApp/
├── index.html               # Shell principal de la PWA con Tailwind CSS
├── manifest.json            # Web App Manifest (instalación en móvil/escritorio)
├── sw.js                    # Service Worker con caché offline-first
├── abrir_app.bat            # Lanzador para Windows de un clic
├── supabase/
│   └── schema.sql           # Esquema DDL SQL para PostgreSQL / Supabase
├── css/
│   └── app.css              # Animaciones, perspectiva 3D para flashcards y scrollbars
├── js/
│   ├── srs.js               # Implementación matemática del algoritmo SM-2
│   ├── db.js                # Capa IndexedDB local + datos de semilla
│   ├── gemini.js            # Cliente Gemini con Structured Outputs (JSON Schema)
│   ├── quiz.js              # Motor de evaluación con justificación paso a paso
│   ├── study.js             # Motor de Flashcard 3D y Active Recall
│   ├── generator.js         # Interfaz para generación masiva de bancos de preguntas
│   └── app.js               # Orquestador del Dashboard, métricas de racha y navegación
└── README.md                # Documentación técnica completa
```

---

## 🧠 3. Algoritmo de Repetición Espaciada (SM-2 Enhanced)

El algoritmo se implementa en [`js/srs.js`](file:///c:/Users/cjtor/Desktop/FlojerApp/js/srs.js). Evalúa la retención en 4 niveles:

| Calificación | Nombre | Efecto en Intervalo | Ajuste de Facilidad ($EF$) |
| :--- | :--- | :--- | :--- |
| **1** | 🔴 Otra vez (Again) | Reinicio a 1 día ($I=1$, $Rep=0$) | Disminución fuerte de $EF$ |
| **2** | 🟡 Difícil (Hard) | Progresión moderada ($1.2 \times$) | Reducción de $EF$ |
| **3** | 🔵 Bueno (Good) | Intervalo estándar SM-2 ($I \times EF$) | Mantiene o ajusta levemente |
| **4** | 🟢 Fácil (Easy) | Salto amplio ($I \times EF \times 1.3$) | Incremento de $EF$ |

### Fórmula de Actualización del Factor de Facilidad:
$$EF' = EF + (0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02))$$
*(Con límite inferior estricto $EF \ge 1.30$)*.

---

## 🤖 4. Gemini API con Structured Outputs (`responseSchema`)

Para garantizar que el modelo nunca devuelva respuestas truncadas o markdown inválido que rompa la interfaz, la llamada a Gemini utiliza el parámetro nativo `responseSchema`:

```javascript
generationConfig: {
  temperature: 0.35,
  responseMimeType: "application/json",
  responseSchema: {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        pregunta: { type: "STRING" },
        tipo: { type: "STRING", enum: ["multiple_choice", "flashcard"] },
        opciones: { type: "ARRAY", items: { type: "STRING" } },
        respuesta_correcta: { type: "INTEGER" },
        explicacion_detallada: { type: "STRING" },
        etiquetas: { type: "ARRAY", items: { type: "STRING" } }
      },
      required: ["pregunta", "tipo", "opciones", "respuesta_correcta", "explicacion_detallada", "etiquetas"]
    }
  }
}
```

---

## 🚀 5. Ejecución & Despliegue

1. **En Local:** Haz doble clic en `abrir_app.bat` o abre `index.html` en cualquier navegador moderno.
2. **Online (GitHub Pages):** Publicado directamente en tu repositorio: [https://cblackmann.github.io/FlojerApp/](https://cblackmann.github.io/FlojerApp/)
3. **Instalación como PWA:** En Chrome o Edge, haz clic en el ícono de instalación en la barra de direcciones para utilizarla como aplicación nativa de escritorio o móvil con soporte offline.
