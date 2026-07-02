-- Track M-Pesa STK checkout IDs so payments can be confirmed quickly via polling
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS checkout_request_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_checkout_request_id
  ON orders(checkout_request_id);

CREATE INDEX IF NOT EXISTS idx_orders_pending_phone
  ON orders(phone, status)
  WHERE status = 'pending_payment';
