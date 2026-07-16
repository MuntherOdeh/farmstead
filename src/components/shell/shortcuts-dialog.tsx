"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { NAV_ITEMS } from "@/lib/nav";

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ShortcutRow({ label, keys }: { label: string; keys: string[] }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm">{label}</span>
      <KbdGroup>
        {keys.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </KbdGroup>
    </div>
  );
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Available anywhere in the app.</DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-border">
          <ShortcutRow label="Command palette" keys={["Ctrl", "K"]} />
          <ShortcutRow label="Search" keys={["/"]} />
          <ShortcutRow label="Toggle sidebar" keys={["Ctrl", "B"]} />
          {NAV_ITEMS.filter((item) => item.shortcut).map((item) => (
            <ShortcutRow
              key={item.href}
              label={`Go to ${item.title.toLowerCase()}`}
              keys={["G", item.shortcut!.toUpperCase()]}
            />
          ))}
          <ShortcutRow label="This dialog" keys={["?"]} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
