-- ============================================
-- D&J Car Rentals - Migration v8: removing a rental takes its payments
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run.
-- ============================================

-- Without this a removed rental leaves its payments live. The money keeps
-- counting as income, tax is set aside on it, and because the rental is
-- hidden the report cannot tell which vehicle it belonged to, so it lands
-- under "Not assigned to a vehicle".
--
-- The cascade stamps the payments with the rental's own deleted_at. Putting
-- the rental back restores exactly that set, so a payment deleted on its own
-- beforehand stays deleted.

CREATE OR REPLACE FUNCTION cascade_rental_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE payments SET deleted_at = NEW.deleted_at
    WHERE rental_id = NEW.id AND deleted_at IS NULL;
  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    UPDATE payments SET deleted_at = NULL
    WHERE rental_id = NEW.id AND deleted_at = OLD.deleted_at;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS rentals_cascade_soft_delete ON rentals;
CREATE TRIGGER rentals_cascade_soft_delete
AFTER UPDATE OF deleted_at ON rentals
FOR EACH ROW EXECUTE FUNCTION cascade_rental_soft_delete();

-- Repair anything already stranded by a removal made before this existed.
UPDATE payments p
SET deleted_at = r.deleted_at
FROM rentals r
WHERE p.rental_id = r.id
  AND r.deleted_at IS NOT NULL
  AND p.deleted_at IS NULL;

-- To check for strays at any time (should return no rows):
--   SELECT p.id, p.amount FROM payments p JOIN rentals r ON r.id = p.rental_id
--   WHERE r.deleted_at IS NOT NULL AND p.deleted_at IS NULL;
