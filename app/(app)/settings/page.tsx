import { requireUser, can } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listOptionSets } from "@/lib/data/option-admin";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const canManageOptions = can(user, "settings", "edit");
  const [{ data: profile }, optionSets] = await Promise.all([
    supabase
      .from("staff_user")
      .select(
        "first_name, last_name, phone, email, profile_picture, notify_email, notify_certifications, notify_renewals, notify_overdue, notify_ending",
      )
      .eq("id", user.id)
      .maybeSingle(),
    canManageOptions ? listOptionSets() : Promise.resolve([]),
  ]);

  return (
    <SettingsClient
      profile={{
        first_name: profile?.first_name ?? "",
        last_name: profile?.last_name ?? "",
        phone: profile?.phone ?? "",
        email: profile?.email ?? user.email,
        avatarUrl: profile?.profile_picture ?? null,
      }}
      notifyPrefs={{
        notify_email: profile?.notify_email ?? true,
        notify_certifications: profile?.notify_certifications ?? true,
        notify_renewals: profile?.notify_renewals ?? true,
        notify_overdue: profile?.notify_overdue ?? true,
        notify_ending: profile?.notify_ending ?? true,
      }}
      optionSets={optionSets}
      canManageOptions={canManageOptions}
    />
  );
}
