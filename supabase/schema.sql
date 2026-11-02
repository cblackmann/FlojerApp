-- =========================================================================
-- FLOJERAPP - REPETICIÓN ESPACIADA & ACTIVE RECALL (PWA)
-- Esquema de Base de Datos PostgreSQL / Supabase DDL
-- =========================================================================

-- Extensiones recomendadas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: Carpetas / Asignaturas
CREATE TABLE IF NOT EXISTS public.folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    description TEXT DEFAULT '',
    icon VARCHAR(32) DEFAULT '📁',
    color VARCHAR(24) DEFAULT '#6366f1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABLA: Flashcards & Preguntas (Active Recall / SM-2)
CREATE TYPE card_type_enum AS ENUM ('flashcard', 'multiple_choice');
CREATE TYPE card_state_enum AS ENUM ('new', 'learning', 'review', 'mastered');

CREATE TABLE IF NOT EXISTS public.cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo card_type_enum DEFAULT 'multiple_choice',
    pregunta TEXT NOT NULL,
    opciones JSONB DEFAULT '[]'::jsonb, -- Array de 4 opciones para selección múltiple
    respuesta_correcta INTEGER DEFAULT 0, -- Índice numérico (0, 1, 2, 3) o texto
    explicacion_detallada TEXT NOT NULL, -- Justificación paso a paso de cada alternativa
    etiquetas TEXT[] DEFAULT ARRAY[]::TEXT[], -- Tags temáticos (ej. ['fisiología', 'cardio'])
    
    -- Parámetros del Algoritmo de Repetición Espaciada (SM-2)
    intervalo INTEGER DEFAULT 1, -- Intervalo actual en días
    repeticiones INTEGER DEFAULT 0, -- Repasos consecutivos exitosos
    facilidad NUMERIC(4, 2) DEFAULT 2.50, -- Ease Factor (mínimo 1.30)
    proxima_revision TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Fecha programada de vencimiento
    estado card_state_enum DEFAULT 'new',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLA: Registro de Sesiones y Log de Repasos (Para estadísticas y racha)
CREATE TABLE IF NOT EXISTS public.reviews_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    calificacion INTEGER NOT NULL CHECK (calificacion BETWEEN 1 AND 4), -- 1: Otra vez, 2: Difícil, 3: Bueno, 4: Fácil
    tiempo_respuesta_ms INTEGER DEFAULT 0,
    acierto BOOLEAN NOT NULL DEFAULT FALSE,
    intervalo_previo INTEGER,
    nuevo_intervalo INTEGER,
    reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABLA: Métricas de Usuario y Rachas
CREATE TABLE IF NOT EXISTS public.user_metrics (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    racha_dias INTEGER DEFAULT 0,
    ultimo_estudio_fecha DATE,
    meta_diaria INTEGER DEFAULT 20, -- Meta de preguntas/flashcards diarias
    total_repasos INTEGER DEFAULT 0,
    total_aciertos INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de alto rendimiento para consultas del Algoritmo SRS
CREATE INDEX IF NOT EXISTS idx_cards_due ON public.cards(proxima_revision) WHERE estado != 'mastered';
CREATE INDEX IF NOT EXISTS idx_cards_folder ON public.cards(folder_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_date ON public.reviews_log(user_id, reviewed_at);

-- RLS (Row Level Security) para privacidad estricta
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own folders" ON public.folders
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own cards" ON public.cards
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their review logs" ON public.reviews_log
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their metrics" ON public.user_metrics
    FOR ALL USING (auth.uid() = user_id);
