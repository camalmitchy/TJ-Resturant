-- Create conversations table for WhatsApp bot state management
CREATE TABLE IF NOT EXISTS conversations (
  phone TEXT PRIMARY KEY,
  step TEXT NOT NULL,
  food_item TEXT,
  price INTEGER,
  room_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index on phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);

-- Optional: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Optional: Clean up old conversations (older than 1 day)
-- You can run this periodically or set up as a cron job
-- DELETE FROM conversations WHERE updated_at < NOW() - INTERVAL '1 day';
