-- Run in Supabase SQL editor (or migrate) so driver signup and the driver dashboard can filter offers by store.

-- Stores each driver applicant wants to work with (multi-select from the app).
-- MUST be an array type (bigint[]), NOT a single bigint — otherwise inserts fail with:
--   invalid input syntax for type bigint: "[14,12,1]"
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS applied_store_ids bigint[] DEFAULT '{}';

COMMENT ON COLUMN public.drivers.applied_store_ids IS 'Store IDs the driver chose during registration; used to show delivery offers after a vendor confirms an order.';

-- If you already added applied_store_ids as bigint (scalar), fix it in SQL editor:
-- ALTER TABLE public.drivers DROP COLUMN IF EXISTS applied_store_ids;
-- ALTER TABLE public.drivers ADD COLUMN applied_store_ids bigint[] DEFAULT '{}';

-- Optional: one assignment row per order (clean up duplicate rows first if this fails).
-- CREATE UNIQUE INDEX IF NOT EXISTS delivery_assignments_order_id_unique
--   ON public.delivery_assignments (order_id);
