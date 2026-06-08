import { requireUser, can } from "@/lib/auth";
import { listCertifications, listCertTypeOptions } from "@/lib/data/certifications";
import { listPropertyOptions } from "@/lib/data/leases";
import { CertificationsClient } from "./certifications-client";

export default async function CertificationsPage() {
  const user = await requireUser();
  const [certs, types, properties] = await Promise.all([
    listCertifications(),
    listCertTypeOptions(),
    listPropertyOptions(),
  ]);

  return (
    <CertificationsClient
      certs={certs}
      types={types}
      properties={properties}
      perms={{
        create: can(user, "certifications", "create"),
        edit: can(user, "certifications", "edit"),
        remove: can(user, "certifications", "delete"),
      }}
    />
  );
}
