import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { getProperty } from "@/lib/data/properties";
import { getPropertyRelated, getAncestors, getPropertyRollup } from "@/lib/data/property-related";
import { getOptions } from "@/lib/data/options";
import { listTenantOptions } from "@/lib/data/tenants";
import { listStaffOptions } from "@/lib/data/staff";
import { listSupplierOptions } from "@/lib/data/suppliers";
import { nominalOptions } from "@/lib/data/nominals";
import { listLeaseOptions } from "@/lib/data/leases";
import { PropertyDetail } from "./property-detail";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [property, related, ancestors, rollup, options, tenants, staff, suppliers, nominals, leases] = await Promise.all([
    getProperty(id),
    getPropertyRelated(id),
    getAncestors(id),
    getPropertyRollup(id),
    // All option sets the in-place "quick add" drawers need (+ utility_type for the utilities panel).
    getOptions([
      "utility_type",
      "maintenance_status", "maintenance_urgency", "maintenance_type",
      "transaction_type", "transaction_category", "vat_rate", "invoice_status",
      "key_status", "held_by_type",
      "payment_frequency", "lease_status", "tenancy_code", "deposit_scheme",
    ]),
    listTenantOptions(),
    listStaffOptions(),
    listSupplierOptions(),
    nominalOptions(),
    listLeaseOptions(),
  ]);
  if (!property) notFound();
  const utilityTypes = (options.utility_type ?? []).map((o) => o.value);

  return (
    <PropertyDetail
      property={property}
      related={related}
      ancestors={ancestors}
      rollup={rollup}
      canEdit={can(user, "properties", "edit")}
      utilityTypes={utilityTypes}
      addData={{ tenants, staff, suppliers, nominals, leases, options }}
    />
  );
}
