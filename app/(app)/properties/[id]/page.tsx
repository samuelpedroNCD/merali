import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { getProperty } from "@/lib/data/properties";
import { getPropertyRelated } from "@/lib/data/property-related";
import { getOptions } from "@/lib/data/options";
import { PropertyDetail } from "./property-detail";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [property, related, options] = await Promise.all([
    getProperty(id),
    getPropertyRelated(id),
    getOptions(["utility_type"]),
  ]);
  if (!property) notFound();
  const utilityTypes = (options.utility_type ?? []).map((o) => o.value);

  return (
    <PropertyDetail
      property={property}
      related={related}
      canEdit={can(user, "properties", "edit")}
      utilityTypes={utilityTypes}
    />
  );
}
