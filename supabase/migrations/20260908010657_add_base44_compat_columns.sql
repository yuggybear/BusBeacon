/*
# Add Base44-compatible columns to existing tables

Adds `created_by_id` and `created_date` columns to tables that the app
expects (Base44 SDK auto-populates these). Also renames chat_messages
columns to match field names used in the code (author_name, created_by_id).
Since tables are empty (freshly created), we can safely add columns.

## Changes
1. All data tables: add `created_by_id text` and `created_date timestamptz DEFAULT now()`
2. chat_messages: add `author_name text` (app uses this instead of sender_name)
3. Remove sender_name/sender_id from chat_messages (replaced by author_name/created_by_id)
*/

-- Add created_by_id and created_date to all tables
ALTER TABLE buses ADD COLUMN IF NOT EXISTS created_by_id text;
ALTER TABLE buses ADD COLUMN IF NOT EXISTS created_date timestamptz DEFAULT now();

ALTER TABLE stops ADD COLUMN IF NOT EXISTS created_by_id text;
ALTER TABLE stops ADD COLUMN IF NOT EXISTS created_date timestamptz DEFAULT now();

ALTER TABLE students ADD COLUMN IF NOT EXISTS created_by_id text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS created_date timestamptz DEFAULT now();

ALTER TABLE student_stops ADD COLUMN IF NOT EXISTS created_by_id text;
ALTER TABLE student_stops ADD COLUMN IF NOT EXISTS created_date timestamptz DEFAULT now();

ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS created_by_id text;
ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS created_date timestamptz DEFAULT now();

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS created_by_id text;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS created_date timestamptz DEFAULT now();

ALTER TABLE parent_links ADD COLUMN IF NOT EXISTS created_by_id text;
ALTER TABLE parent_links ADD COLUMN IF NOT EXISTS created_date timestamptz DEFAULT now();

ALTER TABLE safety_issues ADD COLUMN IF NOT EXISTS created_by_id text;
ALTER TABLE safety_issues ADD COLUMN IF NOT EXISTS created_date timestamptz DEFAULT now();

ALTER TABLE schedule_exceptions ADD COLUMN IF NOT EXISTS created_by_id text;
ALTER TABLE schedule_exceptions ADD COLUMN IF NOT EXISTS created_date timestamptz DEFAULT now();

ALTER TABLE driver_codes ADD COLUMN IF NOT EXISTS created_by_id text;
ALTER TABLE driver_codes ADD COLUMN IF NOT EXISTS created_date timestamptz DEFAULT now();
