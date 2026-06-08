import { requireUser } from "@/lib/auth";
import { listLogs } from "@/lib/data/logs";
import { LogsClient } from "./logs-client";

export default async function LogsPage() {
  await requireUser();
  const logs = await listLogs();
  return <LogsClient logs={logs} />;
}
