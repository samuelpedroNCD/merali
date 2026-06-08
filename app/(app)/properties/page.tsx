import { requireUser, can } from "@/lib/auth";
import { listProperties, listLandlordOptions } from "@/lib/data/properties";
import { getOptions } from "@/lib/data/options";
import { PropertiesClient } from "./properties-client";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await requireUser();
  const { edit } = await searchParams;
  const [properties, landlords, options] = await Promise.all([
    listProperties(),
    listLandlordOptions(),
    getOptions([
      "property_configuration",
      "property_class",
      "property_type",
      "property_status",
      "tenancy_class",
      "property_tax",
    ]),
  ]);

  return (
    <PropertiesClient
      properties={properties}
      landlords={landlords}
      options={options}
      editId={edit}
      perms={{
        create: can(user, "properties", "create"),
        edit: can(user, "properties", "edit"),
        remove: can(user, "properties", "delete"),
      }}
    />
  );
}
