"use client";

import { Eraser, Loader2, RefreshCw, Sprout } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clearAllData, reseedDemoData } from "@/lib/settings/actions";

type Mode = "load" | "reset" | "clear";

const COPY: Record<Mode, { title: string; body: string; confirm: string }> = {
  load: {
    title: "Load demo data?",
    body: "Every product, party, transaction and import will be replaced by a fresh 18-month demo set. User accounts are untouched. This can't be undone.",
    confirm: "Load it",
  },
  reset: {
    title: "Reset the demo data?",
    body: "Every product, party, transaction and import will be replaced by a fresh 18-month demo set. User accounts are untouched. This can't be undone.",
    confirm: "Reset it",
  },
  clear: {
    title: "Erase ALL data and start fresh?",
    body: "Everything goes — demo or real: products, parties, transactions, imports, mapping profiles and saved dashboards. The preset categories, units and your user accounts stay, so you can import your own spreadsheets into a clean farm. This can't be undone.",
    confirm: "Erase everything",
  },
};

export function DemoDataSettings() {
  const router = useRouter();
  const [confirming, setConfirming] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!confirming) return;
    setBusy(true);
    const result =
      confirming === "clear" ? await clearAllData() : await reseedDemoData();
    setBusy(false);
    setConfirming(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (confirming === "clear") {
      toast.success("All data erased — head to Import and upload your real spreadsheets.");
      router.push("/import");
    } else {
      toast.success("Demo data ready — 18 months of transactions loaded.");
    }
    router.refresh();
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Farm data</CardTitle>
        <CardDescription>
          Load the 18-month demo set to show the app off — or erase everything
          and build the ledger from your own spreadsheets via Import.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setConfirming("load")}>
          <Sprout className="size-4" /> Load demo data
        </Button>
        <Button variant="outline" onClick={() => setConfirming("reset")}>
          <RefreshCw className="size-4" /> Reset demo
        </Button>
        <Button variant="destructive" onClick={() => setConfirming("clear")}>
          <Eraser className="size-4" /> Start fresh (erase all)
        </Button>
      </CardContent>

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirming ? COPY[confirming].title : ""}</DialogTitle>
            <DialogDescription>{confirming ? COPY[confirming].body : ""}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirming(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={confirming === "clear" ? "destructive" : "default"}
              onClick={() => void run()}
              disabled={busy}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {confirming ? COPY[confirming].confirm : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
