-- =====================================================================
-- WS13 — VAT: opted-to-tax properties.
-- A property-level flag; transactions relating to an opted-to-tax property are
-- dealt with for VAT (the form defaults the rate to standard when it's set).
-- =====================================================================

alter table property add column if not exists opted_to_tax boolean not null default false;
