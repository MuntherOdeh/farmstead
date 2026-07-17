"use client";

import { Loader2, RefreshCw, Sprout } from "lucide-react";
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
import { reseedDemoData } from "@/lib/settings/actions";

export function DemoDataSettings() {
  const router = useRouter();
  const [confirming, setConfirming] = useState<"load" | "reset" | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const result = await reseedDemoData();
    setBusy(false);
    setConfirming(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Demo data ready — ${result.transactions} transactions across 18 months.`);
    router.refresh();
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Demo data</CardTitle>
        <CardDescription>
          18 months of realistic, seasonal farm data — products, parties and
          ~1,400 transactions. Replaces all current data (accounts stay).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button variant="outline" onClick={() => setConfirming("load")}>
          <Sprout className="size-4" /> Load demo data
        </Button>
        <Button variant="outline" onClick={() => setConfirming("reset")}>
          <RefreshCw className="size-4" /> Reset demo
        </Button>
      </CardContent>

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirming === "reset" ? "Reset the demo data?" : "Load demo data?"}
            </DialogTitle>
            <DialogDescription>
              Every product, party, transaction and import will be replaced by a
              fresh 18-month demo set. User accounts are untouched. This can&apos;t
              be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirming(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void run()} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {confirming === "reset" ? "Reset it" : "Load it"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
