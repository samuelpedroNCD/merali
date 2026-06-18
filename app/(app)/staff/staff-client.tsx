"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2, Copy, Check } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select, Textarea } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { FilterSelect } from "@/components/ui/filter-select";
import { initials } from "@/lib/utils";
import type { StaffRow } from "@/lib/data/staff";
import { inviteStaff, updateStaff, setStaffActive } from "./actions";

type Perms = { create: boolean; edit: boolean };
type Opt = { value: string; label: string };
type Form = Record<string, string>;

function toForm(s?: StaffRow | null): Form {
  return {
    first_name: s?.first_name ?? "",
    last_name: s?.last_name ?? "",
    email: s?.email ?? "",
    phone: s?.phone ?? "",
    role_id: s?.role_id ?? "",
    bio: s?.bio ?? "",
  };
}

export function StaffClient({
  staff,
  roles,
  perms,
}: {
  staff: StaffRow[];
  roles: Opt[];
  perms: Perms;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [form, setForm] = useState<Form>(toForm());
  const [error, setError] = useState<string | null>(null);
  const [tempPw, setTempPw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [roleF, setRoleF] = useState("");
  const [activeF, setActiveF] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const filteredStaff = staff.filter((s) => {
    const q = query.trim().toLowerCase();
    const matchQ = !q || (s.full_name ?? "").toLowerCase().includes(q) || (s.email ?? "").toLowerCase().includes(q);
    return matchQ
      && (!roleF || s.role_id === roleF)
      && (!activeF || (activeF === "active" ? s.is_active : !s.is_active));
  });

  function openCreate() {
    setEditing(null); setForm(toForm()); setError(null); setTempPw(null); setOpen(true);
  }
  function openEdit(s: StaffRow) {
    setEditing(s); setForm(toForm(s)); setError(null); setTempPw(null); setOpen(true);
  }
  function save() {
    setError(null);
    startTransition(async () => {
      if (editing) {
        const res = await updateStaff(editing.id, form);
        if (!res.ok) return setError(res.error);
        setOpen(false); router.refresh();
      } else {
        const res = await inviteStaff(form);
        if (!res.ok) return setError(res.error);
        setTempPw(res.tempPassword ?? null);
        router.refresh();
      }
    });
  }
  function toggleActive(s: StaffRow) {
    startTransition(async () => {
      await setStaffActive(s.id, !s.is_active);
      router.refresh();
    });
  }

  return (
    <>
      <Topbar
        search="Search users…"
        action={
          perms.create ? (
            <Button size="toolbar" className="gap-[6px]" onClick={openCreate}>
              <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> New team member
            </Button>
          ) : undefined
        }
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Staff</h1>
          <p className="mt-[2px] text-[14px] text-muted">Team members and their roles.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="Search name or email…" className="h-[44px] max-w-[360px]" value={query} onChange={(e) => setQuery(e.target.value)} />
          <FilterSelect value={roleF} onChange={setRoleF} placeholder="All roles" options={roles} />
          <FilterSelect value={activeF} onChange={setActiveF} placeholder="Active & inactive" options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
        </div>
        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[680px] grid-cols-[1.6fr_1.8fr_1fr_0.8fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            <span>Name</span><span>Email</span><span>Role</span><span>Status</span><span className="text-right">Action</span>
          </div>
          {filteredStaff.map((s) => (
            <div key={s.id} onClick={() => perms.edit && openEdit(s)} className="grid min-w-[680px] cursor-pointer grid-cols-[1.6fr_1.8fr_1fr_0.8fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[14px] transition-colors last:border-b-0 hover:bg-surface-2/40">
              <span className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-gold-gradient text-[12px] font-bold text-on-gold">{initials(s.full_name || s.email)}</span>
                <span className="truncate font-medium text-text">{s.full_name || "—"}</span>
              </span>
              <span className="truncate text-text-2">{s.email}</span>
              <span>{s.role ? <Badge tone="accent">{s.role}</Badge> : <span className="text-muted">—</span>}</span>
              <span>{s.is_active ? <Badge tone="good" dot>Active</Badge> : <Badge tone="muted">Inactive</Badge>}</span>
              <span className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                {perms.edit && (
                  <>
                    <button onClick={() => toggleActive(s)} className="rounded-md border border-border px-2 py-1 text-[12px] text-text-2 hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                      {s.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => openEdit(s)} className="grid h-8 w-8 place-items-center rounded-md text-text-2 transition-colors hover:bg-surface-2/60" aria-label="Edit">
                      <Pencil strokeWidth={1.6} className="h-[16px] w-[16px]" />
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
        </Card>
      </main>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit team member" : "New team member"}
        subtitle="Add or edit the staff user information"
        size="md"
        footer={
          tempPw ? (
            <Button size="toolbar" onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              {error && <span className="mr-auto text-[15px] font-medium text-[var(--bad)]">{error}</span>}
              <Button variant="ghost" size="toolbar" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="toolbar" onClick={save} disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Invite member"}
              </Button>
            </>
          )
        }
      >
        {tempPw ? (
          <div className="rounded-lg border border-border bg-surface-2/40 p-5">
            <p className="text-[14px] font-semibold text-text">Team member invited</p>
            <p className="mt-1 text-[15px] text-muted">
              Share this temporary password — they can change it in Settings, or use “Forgot password”.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <code className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-[14px] text-text">{tempPw}</code>
              <Button
                variant="ghost"
                size="toolbar"
                onClick={() => { navigator.clipboard.writeText(tempPw); setCopied(true); }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5">
            <Field label="First name"><Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field>
            <Field label="Last name"><Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
            <Field label="Email" className="col-span-2">
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={!!editing} />
            </Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="Role">
              <Select value={form.role_id} onChange={(e) => set("role_id", e.target.value)}>
                <option value="">Choose…</option>
                {roles.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
              </Select>
            </Field>
            <Field label="Bio" className="col-span-2"><Textarea rows={3} value={form.bio} onChange={(e) => set("bio", e.target.value)} /></Field>
          </div>
        )}
      </Drawer>
    </>
  );
}
