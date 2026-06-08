import { createClient } from "@/lib/supabase/server";

export type DocumentRow = {
  id: string;
  name: string;
  external_link: string;
  linked_to: string | null;
  expiry_date: string | null;
  tag: string | null;
  created_at: string;
};

export async function listDocuments(): Promise<DocumentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("document")
    .select("id, name, external_link, linked_to, expiry_date, tag, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as DocumentRow[];
}
