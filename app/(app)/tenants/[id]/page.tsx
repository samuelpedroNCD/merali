import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getTenant } from "@/lib/data/tenants";
import { getTenantRelated } from "@/lib/data/tenant-related";
import { TenantDetail } from "./tenant-detail";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const [tenant, related] = await Promise.all([getTenant(id), getTenantRelated(id)]);
  if (!tenant) notFound();
  return <TenantDetail tenant={tenant} related={related} />;
}
