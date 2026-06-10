-- =====================================================================
-- Real property hierarchy: Building → Sub-building → Unit.
-- Adds a "Sub-building" configuration and replaces the 2-level trigger
-- (check_unit_no_children) with container/leaf + top-level + cycle rules.
--
-- Model:
--   Containers (may have children): Building, Sub-building.
--   Leaf (no children):             Unit.
--   Top-level (no parent allowed):  Building, Standalone Property.
--   Child (needs a container parent): Sub-building, Unit.
-- A Standalone Property keeping legacy child units stays valid (only a
-- Unit is forbidden as a parent), so this migration is backward-compatible.
-- =====================================================================

-- 1) New configuration value, ordered Building → Sub-building → Unit → Standalone.
insert into option_set (category, value, label, sort, is_default, active)
values ('property_configuration', 'Sub-building', 'Sub-building', 2, false, true)
on conflict (category, value) do nothing;
update option_set set sort = 3 where category = 'property_configuration' and value = 'Unit';
update option_set set sort = 4 where category = 'property_configuration' and value = 'Standalone Property';

-- 2) Replace the old 2-level trigger.
drop trigger if exists trg_unit_no_children on property;
drop function if exists check_unit_no_children();

create or replace function check_property_hierarchy()
returns trigger language plpgsql as $$
declare
  parent_config text;
  cursor_id uuid;
  hops int := 0;
begin
  if new.parent_property_id is not null then
    -- A property cannot be its own parent.
    if new.parent_property_id = new.id then
      raise exception 'A property cannot be its own parent';
    end if;

    select configuration into parent_config from property where id = new.parent_property_id;
    if parent_config is null then
      raise exception 'Parent property % does not exist', new.parent_property_id;
    end if;

    -- The parent must be a container — a Unit is a leaf and cannot contain properties.
    if parent_config = 'Unit' then
      raise exception 'A property of configuration "Unit" cannot contain other properties';
    end if;

    -- Buildings and Standalone Properties are top-level and cannot have a parent.
    if new.configuration in ('Building', 'Standalone Property') then
      raise exception 'A "%" must be top-level and cannot have a parent', new.configuration;
    end if;

    -- Cycle guard: walk up the ancestor chain from the parent; reject if we meet ourselves.
    cursor_id := new.parent_property_id;
    while cursor_id is not null loop
      if cursor_id = new.id then
        raise exception 'Circular property hierarchy is not allowed';
      end if;
      hops := hops + 1;
      exit when hops > 50;  -- defensive depth cap
      select parent_property_id into cursor_id from property where id = cursor_id;
    end loop;
  end if;
  return new;
end $$;

create trigger trg_property_hierarchy before insert or update on property
  for each row execute function check_property_hierarchy();
