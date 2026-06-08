-- =====================================================================
-- Merali Lettings — seed data: roles, permission matrix, option sets,
-- certification types. Idempotent (safe to re-run).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------
insert into role (name, description, is_system) values
  ('Admin',   'Full access including deletes of protected records.', true),
  ('Manager', 'Full access except deleting protected records.',      true)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- Permissions: every (module, action) pair
-- ---------------------------------------------------------------------
insert into permission (module, action)
select m, a
from unnest(array[
  'dashboard','properties','units','tenants','landlords','leases','finance',
  'maintenance','keys','suppliers','staff','certifications','documents',
  'reminders','logs','settings','roles'
]) m
cross join unnest(array['view','create','edit','delete']) a
on conflict (module, action) do nothing;

-- Admin: all permissions
insert into role_permission (role_id, permission_id)
select r.id, p.id
from role r cross join permission p
where r.name = 'Admin'
on conflict do nothing;

-- Manager: all EXCEPT delete on protected modules
insert into role_permission (role_id, permission_id)
select r.id, p.id
from role r cross join permission p
where r.name = 'Manager'
  and not (
    p.action = 'delete'
    and p.module in ('properties','units','tenants','landlords','leases',
                     'finance','staff','roles')
  )
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Option sets (user-editable enums)
-- ---------------------------------------------------------------------
with seed(category, value, sort) as (
  values
    ('property_configuration','Building',1),
    ('property_configuration','Standalone Property',2),
    ('property_configuration','Unit',3),
    ('property_class','Flat Above Shop',1),
    ('property_class','Flat',2),
    ('property_class','House',3),
    ('property_class','HMO',4),
    ('property_class','Bungalow',5),
    ('property_class','Maisonette',6),
    ('property_class','Commercial',7),
    ('property_type','Residential',1),
    ('property_type','Commercial',2),
    ('property_type','Mixed Use',3),
    ('property_status','Occupied',1),
    ('property_status','Vacant',2),
    ('property_status','Under Maintenance',3),
    ('property_status','Unavailable',4),
    ('tenancy_class','Residential',1),
    ('tenancy_class','Commercial',2),
    ('property_tax','Council Tax',1),
    ('property_tax','Business Rates',2),
    ('property_tax','Exempt',3),
    ('utility_type','Gas',1),
    ('utility_type','Electricity',2),
    ('utility_type','Water',3),
    ('utility_type','Broadband',4),
    ('tenancy_code','AST – General Assured Shorthold Tenancy',1),
    ('tenancy_code','Assured Tenancy',2),
    ('tenancy_code','Company Let',3),
    ('tenancy_code','Commercial Lease',4),
    ('tenancy_code','Licence',5),
    ('tenancy_code','Non-Housing Act Tenancy',6),
    ('lease_status','Active',1),
    ('lease_status','Pending',2),
    ('lease_status','Expired',3),
    ('lease_status','Ended',4),
    ('lease_status','Renewed',5),
    ('lease_status','Terminated',6),
    ('payment_frequency','Weekly',1),
    ('payment_frequency','Fortnightly',2),
    ('payment_frequency','Monthly',3),
    ('payment_frequency','Quarterly',4),
    ('payment_frequency','Annually',5),
    ('tenant_type','Individual',1),
    ('tenant_type','Company',2),
    ('tenant_type','Student',3),
    ('tenant_type','Joint',4),
    ('tenant_status','Active',1),
    ('tenant_status','Past',2),
    ('tenant_status','Prospective',3),
    ('preferred_contact','Email',1),
    ('preferred_contact','Phone',2),
    ('preferred_contact','SMS',3),
    ('preferred_contact','WhatsApp',4),
    ('nok_relationship','Parent',1),
    ('nok_relationship','Sibling',2),
    ('nok_relationship','Spouse',3),
    ('nok_relationship','Partner',4),
    ('nok_relationship','Child',5),
    ('nok_relationship','Friend',6),
    ('nok_relationship','Other',7),
    ('landlord_type','Individual',1),
    ('landlord_type','Limited Company',2),
    ('landlord_type','Trust',3),
    ('invoice_status','Pending',1),
    ('invoice_status','Paid',2),
    ('invoice_status','Overdue',3),
    ('invoice_status','Partial',4),
    ('maintenance_status','Needs Booking',1),
    ('maintenance_status','Needs Attention',2),
    ('maintenance_status','Open',3),
    ('maintenance_status','In Progress',4),
    ('maintenance_status','Awaiting Parts',5),
    ('maintenance_status','Behind Schedule',6),
    ('maintenance_status','Completed',7),
    ('maintenance_urgency','Low',1),
    ('maintenance_urgency','Medium',2),
    ('maintenance_urgency','High',3),
    ('maintenance_urgency','Emergency',4),
    ('maintenance_type','Plumbing',1),
    ('maintenance_type','Electrical',2),
    ('maintenance_type','Heating',3),
    ('maintenance_type','Appliance',4),
    ('maintenance_type','Structural',5),
    ('maintenance_type','Decorating',6),
    ('maintenance_type','Pest Control',7),
    ('maintenance_type','General',8),
    ('key_status','Out',1),
    ('key_status','In Office',2),
    ('key_status','Lost',3),
    ('key_status','Returned',4),
    ('held_by_type','Tenant',1),
    ('held_by_type','Landlord',2),
    ('held_by_type','Staff',3),
    ('held_by_type','Contractor',4),
    ('held_by_type','Office',5),
    ('transaction_type','Income',1),
    ('transaction_type','Expense',2),
    ('transaction_category','Rent',1),
    ('transaction_category','Deposit',2),
    ('transaction_category','Maintenance',3),
    ('transaction_category','Utilities',4),
    ('transaction_category','Insurance',5),
    ('transaction_category','Management Fee',6),
    ('transaction_category','Mortgage',7),
    ('transaction_category','Service Charge',8),
    ('transaction_category','Ground Rent',9),
    ('transaction_category','Other',10),
    ('vat_rate','0',1),
    ('vat_rate','5',2),
    ('vat_rate','20',3),
    ('supplier_type','Plumber',1),
    ('supplier_type','Electrician',2),
    ('supplier_type','Builder',3),
    ('supplier_type','Gas Engineer',4),
    ('supplier_type','Cleaner',5),
    ('supplier_type','Locksmith',6),
    ('supplier_type','Gardener',7),
    ('supplier_type','General Contractor',8),
    ('supplier_status','Active',1),
    ('supplier_status','Inactive',2),
    ('supplier_status','Preferred',3),
    ('document_linked_to','Property',1),
    ('document_linked_to','Tenant',2),
    ('document_linked_to','Landlord',3),
    ('document_linked_to','Lease',4),
    ('document_linked_to','Maintenance',5),
    ('document_linked_to','Certification',6),
    ('document_linked_to','Staff',7),
    ('document_linked_to','Supplier',8),
    ('document_linked_to','General',9),
    ('reminder_status','Pending',1),
    ('reminder_status','Sent',2),
    ('reminder_status','Completed',3)
)
insert into option_set (category, value, label, sort, is_default)
select category, value, value, sort, (sort = 1)
from seed
on conflict (category, value) do nothing;

-- ---------------------------------------------------------------------
-- Certification types (default reminder lead = 7 days)
-- ---------------------------------------------------------------------
with ct(name, months) as (
  values
    ('British Safety Council Membership/Certification', 12),
    ('Royal Institution of Chartered Surveyors (RICS)', 12),
    ('Institute of Residential Property Management (IRPM)', 12),
    ('Association of Residential Managing Agents (ARMA)', 12),
    ('Electrical Installation Condition Report (EICR) Certification', 60),
    ('EPC (Energy Performance Certificate) Assessor Accreditation', 120),
    ('Gas Safe Registration', 12),
    ('Fire Safety Awareness Certification', 12),
    ('Anti-Money Laundering', 12),
    ('Tenancy Deposit Protection Scheme', 12),
    ('Client Money Protection (CMP) Scheme', 12),
    ('MRICS/FRICS', 12),
    ('ARLA Propertymark Qualification', 12)
)
insert into certification_type (name, default_expiry_period_months, reminder_lead_days)
select name, months, 7 from ct
on conflict (name) do nothing;
