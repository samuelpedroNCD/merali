-- Per-user notification preferences.
alter table staff_user
  add column if not exists notify_email boolean not null default true,
  add column if not exists notify_certifications boolean not null default true,
  add column if not exists notify_renewals boolean not null default true,
  add column if not exists notify_overdue boolean not null default true,
  add column if not exists notify_ending boolean not null default true;
