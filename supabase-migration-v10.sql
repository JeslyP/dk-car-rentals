-- ============================================================
-- D&J Car Rentals: migration v10
-- Costs can be marked as paid or not paid yet.
--
-- A bill that has come in but not been settled (a repair the mechanic has
-- done, to be paid at the end of the month) can now be logged as "not paid
-- yet" and ticked off later, so the owner can see what he still owes.
--
-- Every existing cost was entered as money already spent, so they all start
-- as paid. A cost still counts towards the month of its date either way.
--
-- Safe to run more than once.
-- ============================================================

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT true;

-- Unpaid bills are the few worth finding quickly.
CREATE INDEX IF NOT EXISTS expenses_unpaid_idx ON expenses (spent_on) WHERE NOT is_paid AND deleted_at IS NULL;
