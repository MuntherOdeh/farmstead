"use client";

import { useRouter } from "next/navigation";
import { Keyboard, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  THEME_PRESETS,
  usePreferences,
  type ThemePreset,
} from "@/components/theme/theme-provider";
import { NAV_ITEMS } from "@/lib/nav";

const PRESET_LABELS: Record<ThemePreset, string> = {
  default: "Farmstead",
  pasture: "Pasture",
  honey: "Honey",
  dairy: "Dairy",
  midnight: "Midnight",
  terracotta: "Terracotta",
};

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowShortcuts: () => void;
}

export function CommandPalette({ open, onOpenChange, onShowShortcuts }: CommandPaletteProps) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { setPreset } = usePreferences();

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Go to">
          {NAV_ITEMS.map((item) => (
            <CommandItem key={item.href} onSelect={() => run(() => router.push(item.href))}>
              <item.icon className="size-4" />
              {item.title}
              {item.shortcut ? <CommandShortcut>G {item.shortcut.toUpperCase()}</CommandShortcut> : null}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Mode">
          <CommandItem onSelect={() => run(() => setTheme("light"))}>
            <Sun className="size-4" /> Light
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("dark"))}>
            <Moon className="size-4" /> Dark
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("system"))}>
            <Monitor className="size-4" /> System
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Palette">
          {THEME_PRESETS.map((preset) => (
            <CommandItem key={preset} onSelect={() => run(() => setPreset(preset))}>
              <span
                aria-hidden
                data-theme={preset}
                className="size-3 rounded-full border border-border bg-primary"
              />
              {PRESET_LABELS[preset]}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Help">
          <CommandItem onSelect={() => run(onShowShortcuts)}>
            <Keyboard className="size-4" />
            Keyboard shortcuts
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
