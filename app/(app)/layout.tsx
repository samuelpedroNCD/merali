import { Sidebar } from "@/components/shell/sidebar";
import { requireUser } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { NotificationCountProvider } from "@/components/shell/notification-count";
import { CommandPalette } from "@/components/shell/command-palette";
import { unreadCount } from "@/lib/data/notifications";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const unread = await unreadCount(user.id);

  return (
    <ToastProvider>
      <ConfirmProvider>
        <NotificationCountProvider count={unread}>
        <div className="flex h-screen overflow-hidden bg-bg text-text">
          <Sidebar
            user={{
              name: user.name,
              role: user.roleName || "Staff",
              avatarUrl: user.avatarUrl,
              permissions: [...user.permissions],
            }}
          />
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
        <CommandPalette />
        </NotificationCountProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
