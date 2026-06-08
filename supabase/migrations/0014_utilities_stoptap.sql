-- Utilities: add stop-tap location (meter location + serial already exist).
alter table utility
  add column if not exists stop_tap_location text;
