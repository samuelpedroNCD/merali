import { requireUser, can } from "@/lib/auth";
import { listLandlords } from "@/lib/data/landlords";
import { getOptions } from "@/lib/data/options";
import { LandlordsClient } from "./landlords-client";

export default async function LandlordsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await requireUser();
  const { edit } = await searchParams;
  const [landlords, options] = await Promise.all([
    listLandlords(),
    getOptions(["landlord_type", "preferred_contact"]),
  ]);

  return (
    <LandlordsClient
      landlords={landlords}
      options={options}
      editId={edit}
      perms={{
        create: can(user, "landlords", "create"),
        edit: can(user, "landlords", "edit"),
        remove: can(user, "landlords", "delete"),
      }}
    />
  );
}
