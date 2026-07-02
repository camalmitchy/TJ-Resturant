-- WhatsApp bot session state (replaces conversations table)
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  phone TEXT PRIMARY KEY,
  step TEXT NOT NULL DEFAULT 'start',
  food_item TEXT NULL,
  price INT8 NULL,
  room_number TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone ON public.whatsapp_sessions(phone);
