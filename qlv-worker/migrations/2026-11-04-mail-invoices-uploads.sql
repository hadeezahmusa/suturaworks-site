-- The Email tab, invoices (made and sent, no reconciliation) and the admin
-- bulk upload for sponsored bookings.

-- Every email sent from the Email tab, for the record.
CREATE TABLE IF NOT EXISTS mail_sent (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_list TEXT NOT NULL,          -- JSON list
  cc_list TEXT NOT NULL,          -- JSON list
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attachments TEXT NOT NULL,      -- JSON list of {name, size}
  invoice_id INTEGER,             -- set when the email carried an invoice
  ok INTEGER NOT NULL,
  detail TEXT,
  sent_at TEXT NOT NULL,
  sent_by TEXT NOT NULL
);

-- Invoices. The number (QLV 0020 upwards) is given on first save and never
-- reused. Editable until emailed; cancelled ones are kept and print
-- "Cancelled".
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number INTEGER NOT NULL UNIQUE,
  bill_org TEXT NOT NULL,
  bill_contact TEXT,
  bill_title TEXT,
  bill_address TEXT,
  bill_email TEXT,
  bill_phone TEXT,
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  lines TEXT NOT NULL,            -- JSON list of {item, title, description, qty, unit, amount, seats}
  subtotal INTEGER NOT NULL,
  total INTEGER NOT NULL,
  seats INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  emailed_at TEXT,
  cancelled_at TEXT,
  cancelled_by TEXT,
  copied_from INTEGER
);

-- Bulk uploads onto a sponsored booking, and how each seat was filled.
CREATE TABLE IF NOT EXISTS seat_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reg_ref TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  imported INTEGER NOT NULL,
  skipped INTEGER NOT NULL,
  failed INTEGER NOT NULL
);
ALTER TABLE tickets ADD COLUMN via TEXT;  -- 'upload' for a seat filled by bulk upload; null for the share link
