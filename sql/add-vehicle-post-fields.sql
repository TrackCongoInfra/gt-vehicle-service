-- ══════════════════════════════════════════════════════════════════════
-- gt-vehicle-service — ALTER vehicles to support the extended POST payload.
-- Idempotent: safe to run multiple times.
--
-- Fields covered by the updated POST /vehicles:
--   vehicleNo, mileage, vehicleType, overspeed, imei, attachedCoin,
--   transporterUsername, subscriptionDue, subscriptionStart,
--   durationOdometer, extraRemark, remark, odometer, alias,
--   parkAlarmOnIgnitionOn, autoRenewal, lock
--
-- New vehicles columns (only attached_coin is truly new; the others are
-- already in code and defensively added here in case the DB is behind).
-- Subscription fields (start/due/autoRenewal) live on organization_users —
-- nothing to ALTER there, they already exist.
-- ══════════════════════════════════════════════════════════════════════

BEGIN;

-- Defensive: columns added in previous code migrations but may be missing
-- on older DB copies.
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS mileage numeric(6,2) DEFAULT 1;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS fuel_type varchar(30);

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS duration_odometer numeric(12,1);

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS remarks_2 text;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS parking_violation_alarm boolean NOT NULL DEFAULT false;

-- New column: attached coin identifier (e.g. "bL1gYhJ (11/05/2026)").
-- Stored as-is; parsing of the expiry date is UI-side because coin
-- management lives outside this service.
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS attached_coin varchar(100);

-- user_id (owner/assigned user that drives subscription lookups)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS idx_vehicles_user_id
  ON public.vehicles (user_id)
  WHERE user_id IS NOT NULL;

COMMIT;
