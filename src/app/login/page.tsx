import type { Metadata } from "next";
import { Wheat } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-e bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wheat className="size-4.5" />
          </span>
          <span className="font-heading text-lg font-semibold tracking-tight">Farmstead</span>
        </div>
        <div>
          <h1 className="font-heading text-4xl font-semibold leading-tight tracking-tight">
            The whole farm,
            <br />
            in one place.
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Livestock, dairy, honey and wool — spreadsheets in, decisions out.
            Imports, products, ledger and analytics behind one login.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Private system · authorised accounts only
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wheat className="size-4.5" />
            </span>
            <span className="font-heading text-lg font-semibold tracking-tight">Farmstead</span>
          </div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">
            Sign in with your username and password.
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
