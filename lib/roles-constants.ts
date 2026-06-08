// Server-free constants so client components can import them safely.
export const MODULE_ORDER = [
  "dashboard", "properties", "units", "tenants", "landlords", "leases", "finance",
  "maintenance", "keys", "suppliers", "staff", "certifications", "documents",
  "reminders", "logs", "settings", "roles",
];
export const ACTIONS = ["view", "create", "edit", "delete"] as const;
