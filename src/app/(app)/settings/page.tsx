import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireUser } from "@/lib/auth/require-user";
import { AccountSettings } from "@/components/settings/account-settings";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { UsersSettings, type UserRow } from "@/components/settings/users-settings";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();

  let users: UserRow[] = [];
  if (user.role === "admin") {
    const db = await getDb();
    users = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        username: schema.user.username,
        role: schema.user.role,
      })
      .from(schema.user)
      .orderBy(asc(schema.user.createdAt));
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Appearance, account and access. Currency, units, categories and demo
          data controls arrive with the later milestones.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-medium">Appearance</h2>
        <AppearanceSettings />
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-medium">Account</h2>
        <AccountSettings />
      </section>

      {user.role === "admin" ? (
        <>
          <Separator />
          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-lg font-medium">Access</h2>
            <UsersSettings users={users} currentUserId={user.id} />
          </section>
        </>
      ) : null}
    </div>
  );
}
