"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { NAV } from "@/lib/nav";
import { cn, initials } from "@/lib/utils";

export function Sidebar({
  user,
}: {
  user: { name: string; role: string; permissions: string[]; avatarUrl?: string | null };
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const allowed = new Set(user.permissions);
  // Show a nav item if the user can view its module (dashboard + reports always
  // shown — the reports page self-filters to the exports each role can access).
  const canView = (module: string) =>
    module === "dashboard" || module === "reports" || allowed.has(`${module}:view`);

  // Toggle from the topbar burger; close on navigation.
  useEffect(() => {
    const onToggle = () => setMobileOpen((v) => !v);
    window.addEventListener("merali:nav", onToggle);
    return () => window.removeEventListener("merali:nav", onToggle);
  }, []);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile scrim */}
      <button
        aria-label="Close menu"
        onClick={() => setMobileOpen(false)}
        className={cn(
          "fixed inset-0 z-[100] bg-[rgba(46,36,12,0.45)] md:hidden",
          mobileOpen ? "block" : "hidden",
        )}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[105] flex w-[248px] shrink-0 flex-col bg-side-bg px-[16px] py-[12px] text-side-text transition-transform duration-200 md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
      {/* Logo — gold on dark; height set, width auto, no stretch */}
      <Image
        src="/assets/logo.png"
        alt="Merali Lettings"
        width={126}
        height={31}
        priority
        className="mx-2 mb-[10px] mt-[2px] h-[31px] w-auto self-start"
      />

      <nav className="flex flex-1 flex-col gap-0 overflow-y-auto thin-scroll">
        {NAV.map((section) => {
          const items = section.items.filter((i) => canView(i.module));
          if (!items.length) return null;
          return (
          <div key={section.label} className="contents">
            <p className="mb-[2px] mt-[7px] px-3 text-[10.5px] uppercase tracking-[0.2em] text-side-text/55">
              {section.label}
            </p>
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={cn(
                    "relative flex items-center gap-[12px] rounded-[9px] px-[12px] py-[7px] text-[14px] font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/50",
                    active
                      ? "bg-side-active text-[#F0E0C0]"
                      : "text-side-text hover:text-[#E7DFCB]",
                  )}
                >
                  {active && (
                    <span className="absolute bottom-[8px] left-0 top-[8px] w-[3px] rounded-[3px] bg-gold-gradient" />
                  )}
                  <Icon strokeWidth={1.6} className="h-[17px] w-[17px]" />
                  {item.label}
                </Link>
              );
            })}
          </div>
          );
        })}
      </nav>

      {/* Footer: avatar + name/role + logout */}
      <div className="mt-2 border-t border-white/[0.07] pt-2">
        <div className="flex items-center gap-3 px-1">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={user.name} className="h-[34px] w-[34px] shrink-0 rounded-[10px] object-cover" />
          ) : (
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-gold-gradient text-[12.5px] font-bold text-on-gold">
              {initials(user.name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold text-[#E7DFCB]">
              {user.name}
            </p>
            <p className="truncate text-[11.5px] text-side-text">{user.role}</p>
          </div>
          <Link
            href="/logout"
            aria-label="Log out"
            className="grid h-8 w-8 place-items-center rounded-md text-side-text transition-colors hover:text-[#E7DFCB]"
          >
            <LogOut strokeWidth={1.6} className="h-[17px] w-[17px]" />
          </Link>
        </div>
      </div>
    </aside>
    </>
  );
}
