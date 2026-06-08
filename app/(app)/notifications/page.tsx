import { requireUser } from "@/lib/auth";
import { listNotifications } from "@/lib/data/notifications";
import { NotificationsClient } from "./notifications-client";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await listNotifications(user.id);
  return <NotificationsClient notifications={notifications} />;
}
