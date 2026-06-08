import { requireUser, can } from "@/lib/auth";
import { listDocuments } from "@/lib/data/documents";
import { getOptions } from "@/lib/data/options";
import { DocumentsClient } from "./documents-client";

export default async function DocumentsPage() {
  const user = await requireUser();
  const [documents, options] = await Promise.all([
    listDocuments(),
    getOptions(["document_linked_to"]),
  ]);

  return (
    <DocumentsClient
      documents={documents}
      options={options}
      perms={{
        create: can(user, "documents", "create"),
        remove: can(user, "documents", "delete"),
      }}
    />
  );
}
