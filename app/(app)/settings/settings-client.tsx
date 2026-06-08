"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { FileUpload } from "@/components/ui/file-upload";
import { initials } from "@/lib/utils";
import { updateProfile, changePassword, changeEmail, updateAvatar, updateNotificationPrefs } from "./actions";
import { OptionSetsManager } from "./option-sets-manager";
import type { OptionCategory } from "@/lib/data/option-admin";

type NotifyPrefs = {
  notify_email: boolean;
  notify_certifications: boolean;
  notify_renewals: boolean;
  notify_overdue: boolean;
  notify_ending: boolean;
};

export function SettingsClient({
  profile,
  notifyPrefs,
  optionSets,
  canManageOptions,
}: {
  profile: { first_name: string; last_name: string; phone: string; email: string; avatarUrl: string | null };
  notifyPrefs: NotifyPrefs;
  optionSets: OptionCategory[];
  canManageOptions: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState("personal");

  const tabs = [
    { key: "personal", label: "Personal Info" },
    { key: "account", label: "Account Settings" },
    { key: "notifications", label: "Notifications" },
    ...(canManageOptions ? [{ key: "options", label: "Option Sets" }] : []),
  ];

  return (
    <>
      <Topbar search="Search…" />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Settings</h1>
          <p className="mt-[2px] text-[14px] text-muted">Manage your profile and account.</p>
        </div>
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        {tab === "personal" && <PersonalInfo profile={profile} onSaved={() => router.refresh()} />}
        {tab === "account" && <AccountSettings email={profile.email} />}
        {tab === "notifications" && <NotificationPrefs prefs={notifyPrefs} onSaved={() => router.refresh()} />}
        {tab === "options" && canManageOptions && <OptionSetsManager optionSets={optionSets} />}
      </main>
    </>
  );
}

function PersonalInfo({
  profile,
  onSaved,
}: {
  profile: { first_name: string; last_name: string; phone: string; avatarUrl: string | null };
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    first_name: profile.first_name,
    last_name: profile.last_name,
    phone: profile.phone,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function save() {
    setMsg(null);
    setError(null);
    start(async () => {
      const res = await updateProfile(form);
      if (!res.ok) return setError(res.error);
      setMsg("Profile saved.");
      onSaved();
    });
  }

  function onAvatar(url: string) {
    start(async () => {
      const res = await updateAvatar(url);
      if (!res.ok) return setError(res.error);
      setMsg("Photo updated.");
      onSaved();
    });
  }

  return (
    <Card className="max-w-[680px]">
      <h3 className="text-[16px] font-semibold text-text">Personal information</h3>
      <p className="mb-5 mt-1 text-[13px] text-muted">Modify your profile details here.</p>
      <div className="mb-5 flex items-center gap-4">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt="Profile" className="h-16 w-16 rounded-xl object-cover" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-xl bg-gold-gradient text-[20px] font-bold text-on-gold">
            {initials(`${form.first_name} ${form.last_name}`) || "?"}
          </span>
        )}
        <FileUpload bucket="avatars" label="Change photo" onUploaded={onAvatar} />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <Field label="First name"><Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field>
        <Field label="Last name"><Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
        <Field label="Phone" className="col-span-2"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <Button size="toolbar" onClick={save} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </Button>
        {msg && (
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--good)]">
            <Check className="h-4 w-4" /> {msg}
          </span>
        )}
        {error && <span className="text-[13px] font-medium text-[var(--bad)]">{error}</span>}
      </div>
    </Card>
  );
}

const PREF_TYPES: { key: keyof NotifyPrefs; label: string; desc: string }[] = [
  { key: "notify_certifications", label: "Certification expiry", desc: "Alerts when a certificate is approaching its expiry date." },
  { key: "notify_renewals", label: "Lease renewals", desc: "Tenancies due for renewal this month." },
  { key: "notify_overdue", label: "Rent overdue", desc: "When a tenancy falls into rent arrears." },
  { key: "notify_ending", label: "Lease ending soon", desc: "Tenancies ending within the next 60 days." },
];

function NotificationPrefs({ prefs, onSaved }: { prefs: NotifyPrefs; onSaved: () => void }) {
  const [form, setForm] = useState<NotifyPrefs>(prefs);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (k: keyof NotifyPrefs) => setForm((f) => ({ ...f, [k]: !f[k] }));

  function save() {
    setMsg(null);
    setError(null);
    start(async () => {
      const res = await updateNotificationPrefs(form);
      if (!res.ok) return setError(res.error);
      setMsg("Preferences saved.");
      onSaved();
    });
  }

  return (
    <Card className="max-w-[680px]">
      <h3 className="text-[16px] font-semibold text-text">Notification preferences</h3>
      <p className="mb-5 mt-1 text-[13px] text-muted">Choose which alerts you receive and how.</p>

      <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Channels</p>
      <Toggle
        checked={form.notify_email}
        onChange={() => toggle("notify_email")}
        label="Email notifications"
        desc="Also send alerts to your email address (in-app is always on)."
      />

      <p className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Alert types</p>
      <div className="flex flex-col divide-y divide-border">
        {PREF_TYPES.map((t) => (
          <Toggle key={t.key} checked={form[t.key]} onChange={() => toggle(t.key)} label={t.label} desc={t.desc} />
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button size="toolbar" onClick={save} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Save preferences
        </Button>
        {msg && (
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--good)]">
            <Check className="h-4 w-4" /> {msg}
          </span>
        )}
        {error && <span className="text-[13px] font-medium text-[var(--bad)]">{error}</span>}
      </div>
    </Card>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  desc: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-text">{label}</p>
        <p className="text-[12.5px] text-muted">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        className={`relative h-[24px] w-[42px] shrink-0 rounded-full transition-colors ${checked ? "bg-gold-gradient" : "bg-surface-2 border border-border"}`}
      >
        <span className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-surface shadow-sm transition-all ${checked ? "left-[21px]" : "left-[3px]"}`} />
      </button>
    </div>
  );
}

function AccountSettings({ email }: { email: string }) {
  return (
    <div className="flex max-w-[680px] flex-col gap-[18px]">
      <ChangeEmailCard currentEmail={email} />
      <ChangePasswordCard />
      <Card>
        <h3 className="text-[16px] font-semibold text-text">Delete account</h3>
        <p className="mt-1 text-[13px] text-muted">
          Account removal is restricted — ask an administrator. (Wired with staff admin in a later phase.)
        </p>
        <Button variant="danger" size="toolbar" className="mt-4" disabled>
          Delete account
        </Button>
      </Card>
    </div>
  );
}

function ChangeEmailCard({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState(currentEmail);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function save() {
    setMsg(null);
    setError(null);
    start(async () => {
      const res = await changeEmail(email);
      if (!res.ok) return setError(res.error);
      setMsg("Confirmation email sent to the new address.");
    });
  }
  return (
    <Card>
      <h3 className="text-[16px] font-semibold text-text">Change email</h3>
      <p className="mb-4 mt-1 text-[13px] text-muted">Update your registered email address.</p>
      <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <div className="mt-4 flex items-center gap-3">
        <Button size="toolbar" onClick={save} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Update email
        </Button>
        {msg && <span className="text-[13px] font-medium text-[var(--good)]">{msg}</span>}
        {error && <span className="text-[13px] font-medium text-[var(--bad)]">{error}</span>}
      </div>
    </Card>
  );
}

function ChangePasswordCard() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function save() {
    setMsg(null);
    setError(null);
    if (pw !== pw2) return setError("Passwords do not match.");
    start(async () => {
      const res = await changePassword(pw);
      if (!res.ok) return setError(res.error);
      setMsg("Password updated.");
      setPw("");
      setPw2("");
    });
  }
  return (
    <Card>
      <h3 className="text-[16px] font-semibold text-text">Change password</h3>
      <p className="mb-4 mt-1 text-[13px] text-muted">Use a mix of letters, numbers and symbols.</p>
      <div className="grid grid-cols-2 gap-5">
        <Field label="New password"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field label="Confirm password"><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button size="toolbar" onClick={save} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Change password
        </Button>
        {msg && <span className="text-[13px] font-medium text-[var(--good)]">{msg}</span>}
        {error && <span className="text-[13px] font-medium text-[var(--bad)]">{error}</span>}
      </div>
    </Card>
  );
}
