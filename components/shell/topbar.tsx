"use client";

import Link from "next/link";
import { Search, Bell, Moon, Sun, Menu } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { useTheme } from "@/components/theme-provider";
import { useNotificationCount } from "@/components/shell/notification-count";

export function Topbar({
  search = "Search…",
  action,
}: {
  search?: string;
  action?: React.ReactNode;
}) {
  const { theme, toggleTheme } = useTheme();
  const unread = useNotificationCount();

  return (
    <header className="flex h-[74px] shrink-0 items-center gap-3 border-b border-border px-[18px] md:gap-5 md:px-[34px]">
      {/* Mobile menu toggle */}
      <IconButton
        aria-label="Open menu"
        className="md:hidden"
        onClick={() => window.dispatchEvent(new Event("merali:nav"))}
      >
        <Menu strokeWidth={1.6} />
      </IconButton>
      {/* Search — opens the command palette */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("merali:command"))}
        className="flex h-[42px] w-full max-w-[380px] items-center gap-[10px] rounded-md border border-border bg-surface-2 px-[14px] text-muted transition-colors hover:bg-surface-2/70"
      >
        <Search strokeWidth={1.6} className="h-[18px] w-[18px]" />
        <span className="flex-1 text-left text-[14px]">{search}</span>
        <kbd className="rounded border border-border px-1.5 py-0.5 text-[11px]">⌘K</kbd>
      </button>

      <div className="flex-1" />

      <Link
        href="/notifications"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative grid h-[42px] w-[42px] place-items-center rounded-md border border-border bg-surface text-text-2 transition-colors hover:bg-surface-2/60 [&_svg]:h-[18px] [&_svg]:w-[18px]"
      >
        <Bell strokeWidth={1.6} />
        {unread > 0 && (
          <span className="absolute -right-[5px] -top-[5px] grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--bad)] px-[5px] text-[10.5px] font-bold leading-none text-white ring-2 ring-surface">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>

      {action}

      <IconButton aria-label="Toggle theme" onClick={toggleTheme}>
        {theme === "dark" ? <Sun strokeWidth={1.6} /> : <Moon strokeWidth={1.6} />}
      </IconButton>
    </header>
  );
}
