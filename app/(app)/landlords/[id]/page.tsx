import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLandlord } from "@/lib/data/landlords";
import { getLandlordRelated } from "@/lib/data/landlord-related";
import { LandlordDetail } from "./landlord-detail";

export default async function LandlordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const [landlord, related] = await Promise.all([getLandlord(id), getLandlordRelated(id)]);
  if (!landlord) notFound();
  return <LandlordDetail landlord={landlord} related={related} />;
}
