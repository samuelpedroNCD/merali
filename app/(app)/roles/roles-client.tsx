"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { RoleWithPerms, Permission } from "@/lib/data/roles";
import { MODULE_ORDER, ACTIONS } from "@/lib/roles-constants";
import { createRole, setRolePermission, deleteRole } from "./actions";

type Perms = { create: boolean; edit: boolean; remove: boolean };

export function RolesClient({
  roles,
  permissions,
  perms,
}: {
  roles: RoleWithPerms[];
  permissions: Permission[];
  perms: Perms;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState(roles[0]?.id ?? "");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, start] = useTransition();

  // module:action -> permissionId
  const permIndex = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of permissions) m.set(`${p.module}:${p.action}`, p.id);
    return m;
  }, [permissions]);

  const role = roles.find((r) => r.id === selectedId);
  const has = (permId: string) => role?.permissionIds.includes(permId) ?? false;

  function toggle(module: string, action: string) {
    if (!role || !perms.edit) return;
    const permId = permIndex.get(`${module}:${action}`);
    if (!permId) return;
    start(async () => {
      const res = await setRolePermission(role.id, permId, !has(permId));
      if (!res.ok) return toast.error(res.error);
      router.refresh();
    });
  }

  function create() {
    start(async () => {
      const res = await createRole(name, description);
      if (!res.ok) return toast.error(res.error);
      toast.success("Role created.");
      setDrawerOpen(false);
      setName(""); setDescription("");
      if (res.id) setSelectedId(res.id);
      router.refresh();
    });
  }

  function remove(r: RoleWithPerms) {
    start(async () => {
      if (!(await confirm({ title: "Delete role", message: `Delete the "${r.name}" role? This cannot be undone.`, danger: true, confirmLabel: "Delete" }))) return;
      const res = await deleteRole(r.id);
      if (!res.ok) return toast.error(res.error);
      toast.success("Role deleted.");
      setSelectedId(roles[0]?.id ?? "");
      router.refresh();
    });
  }

  return (
    <>
      <Topbar
        search="Search…"
        action={
          perms.create ? (
            <Button size="toolbar" className="gap-[6px]" onClick={() => setDrawerOpen(true)}>
              <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> New role
            </Button>
          ) : undefined
        }
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Roles &amp; permissions</h1>
          <p className="mt-[2px] text-[14px] text-muted">Control what each role can see and do.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-pill border px-[14px] py-[8px] text-[15px] font-semibold transition-colors",
                selectedId === r.id ? "border-transparent bg-gold-gradient text-on-gold" : "border-border text-text-2 hover:bg-surface-2/60",
              )}
            >
              <ShieldCheck strokeWidth={1.6} className="h-[16px] w-[16px]" />
              {r.name}
              {r.is_system && <Badge tone="muted">system</Badge>}
            </button>
          ))}
        </div>

        {role && (
          <Card className="p-0">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <h3 className="text-[16px] font-semibold text-text">{role.name}</h3>
                {role.description && <p className="text-[15px] text-muted">{role.description}</p>}
              </div>
              {perms.remove && !role.is_system && (
                <Button variant="danger" size="toolbar" className="gap-[6px]" onClick={() => remove(role)} disabled={pending}>
                  <Trash2 strokeWidth={1.6} className="h-[16px] w-[16px]" /> Delete role
                </Button>
              )}
            </div>

            <div className="overflow-x-auto border-t border-border">
              <div className="grid grid-cols-[1.4fr_repeat(4,0.6fr)] items-center gap-2 border-b border-border px-6 py-3 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
                <span>Module</span>
                {ACTIONS.map((a) => <span key={a} className="text-center capitalize">{a}</span>)}
              </div>
              {MODULE_ORDER.map((module) => (
                <div key={module} className="grid grid-cols-[1.4fr_repeat(4,0.6fr)] items-center gap-2 border-b border-border px-6 py-[10px] text-[13.5px] last:border-b-0">
                  <span className="capitalize text-text">{module}</span>
                  {ACTIONS.map((action) => {
                    const permId = permIndex.get(`${module}:${action}`);
                    const checked = permId ? has(permId) : false;
                    return (
                      <span key={action} className="flex justify-center">
                        <button
                          disabled={!permId || !perms.edit || pending}
                          onClick={() => toggle(module, action)}
                          aria-label={`${role.name} ${module} ${action}`}
                          className={cn(
                            "grid h-[20px] w-[20px] place-items-center rounded-[6px] border transition-colors",
                            checked ? "border-transparent bg-gold-gradient text-on-gold" : "border-border bg-surface",
                            (!perms.edit || !permId) && "opacity-50",
                          )}
                        >
                          {checked && <CheckMark />}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="New role"
        subtitle="Create a custom role, then set its permissions"
        size="md"
        footer={
          <>
            <Button variant="ghost" size="toolbar" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button size="toolbar" onClick={create} disabled={pending || !name.trim()}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Create role
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5">
          <Field label="Role name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Accountant" /></Field>
          <Field label="Description"><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        </div>
      </Drawer>
    </>
  );
}

function CheckMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
