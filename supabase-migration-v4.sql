-- ============================================
-- D&J Car Rentals - Migration v4
-- Matches the app to how the paper log sheets are actually filled in.
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run.
-- ============================================

-- On the paper sheets the phone column is usually blank: the name is what
-- identifies a customer. Requiring a phone number blocked entry, so it is
-- now optional.
ALTER TABLE renters ALTER COLUMN phone DROP NOT NULL;

-- Blank strings imported earlier become NULL so "no phone" is one value.
UPDATE renters SET phone = NULL WHERE phone IS NOT NULL AND btrim(phone) = '';

-- Looking a customer up by name is the common case when transcribing a sheet.
CREATE INDEX IF NOT EXISTS renters_name_lower_idx ON renters (lower(name));
