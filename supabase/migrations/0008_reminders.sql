-- Recurring reminders + entity linking.
alter table reminder
  add column if not exists recurrence text not null default 'None',  -- None|Daily|Weekly|Monthly|Yearly
  add column if not exists recurrence_until date,
  add column if not exists property_id uuid references property(id) on delete set null;

create index if not exists reminder_recurrence_idx on reminder (recurrence) where recurrence <> 'None';
