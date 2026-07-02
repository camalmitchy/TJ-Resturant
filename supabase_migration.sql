-- Create orders table for TJ Restaurant
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  food_item TEXT NOT NULL,
  room_number TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT DEFAULT 'pending_payment',
  channel TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: Add an index on created_at for faster sorting
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Optional: Add an index on status for filtering
CREATE INDEX idx_orders_status ON orders(status);
