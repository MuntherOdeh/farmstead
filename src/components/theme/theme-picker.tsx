"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  THEME_PRESETS,
  usePreferences,
  type ThemePreset,
} from "@/components/theme/theme-provider";

const PRESET_LABELS: Record<ThemePreset, string> = {
  default: "Farmstead",
  pasture: "Pasture",
  honey: "Honey",
  dairy: "Dairy",
  midnight: "Midnight",
  terracotta: "Terracotta",
};

function PresetSwatch({ preset }: { preset: ThemePreset }) {
  return (
    <span
      aria-hidden
      data-theme={preset}
      className="size-3 shrink-0 rounded-full border border-border bg-primary"
    />
  );
}

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const { preset, setPreset } = usePreferences();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
          <span className="sr-only">Change theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Mode</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4" /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4" /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Palette</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preset}
          onValueChange={(value) => setPreset(value as ThemePreset)}
        >
          {THEME_PRESETS.map((p) => (
            <DropdownMenuRadioItem key={p} value={p}>
              <PresetSwatch preset={p} />
              {PRESET_LABELS[p]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
