import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { getProperty } from "@/lib/data/properties";
import { getPropertyRelated } from "@/lib/data/property-related";
import { PropertyDetail } from "./property-detail";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [property, related] = await Promise.all([
    getProperty(id),
    getPropertyRelated(id),
  ]);
  if (!property) notFound();

  return <PropertyDetail property={property} related={related} canEdit={can(user, "properties", "edit")} />;
}
