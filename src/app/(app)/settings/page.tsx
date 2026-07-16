import type { Metadata } from "next";
import { AppearanceSettings } from "@/components/settings/appearance-settings";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Appearance is live now; currency, units, categories, users and demo
          data controls arrive with the database and auth milestones.
        </p>
      </div>
      <AppearanceSettings />
    </div>
  );
}
