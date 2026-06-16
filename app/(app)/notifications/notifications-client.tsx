"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCheck, Play, Loader2 } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { NotificationRow } from "@/lib/data/notifications";
import { markRead, markAllRead, runNotificationTriggers } from "./actions";

function fmt(d: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

export function NotificationsClient({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <>
      <Topbar
        search="Search…"
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="toolbar" className="gap-[6px]" onClick={() => start(async () => { await runNotificationTriggers(); router.refresh(); })} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play strokeWidth={1.6} className="h-[16px] w-[16px]" />}
              Run checks
            </Button>
            <Button size="toolbar" className="gap-[6px]" onClick={() => start(async () => { await markAllRead(); router.refresh(); })} disabled={pending || unread === 0}>
              <CheckCheck strokeWidth={1.6} className="h-[16px] w-[16px]" /> Mark all read
            </Button>
          </div>
        }
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Notifications</h1>
          <p className="mt-[2px] text-[14px] text-muted">
            {unread > 0 ? `${unread} unread · ` : ""}Alerts about expiries, renewals and overdue rent.
          </p>
        </div>
        <Card className="p-0">
          {notifications.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <BellRing strokeWidth={1.4} className="mb-2 h-8 w-8 text-muted" />
              <p className="text-[15px] font-medium text-text-2">You're all caught up</p>
              <p className="mt-1 text-[15px] text-muted">Notifications about expiries, renewals and overdue rent appear here.</p>
            </div>
          )}
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.read_at && start(async () => { await markRead(n.id); router.refresh(); })}
              className={cn(
                "flex w-full items-start gap-[13px] border-b border-border px-6 py-4 text-left transition-colors last:border-b-0 hover:bg-surface-2/40",
                !n.read_at && "bg-surface-2/30",
              )}
            >
              <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-[var(--warn)]")} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-text">{n.type}</p>
                <p className="mt-[2px] text-[15px] text-text-2">{n.message}</p>
              </div>
              <span className="shrink-0 text-[12px] text-muted">{fmt(n.created_at)}</span>
            </button>
          ))}
        </Card>
      </main>
    </>
  );
}
