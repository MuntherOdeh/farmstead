"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  DENSITIES,
  DIRECTIONS,
  THEME_PRESETS,
  usePreferences,
  type Density,
  type Direction,
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

const PRESET_DESCRIPTIONS: Record<ThemePreset, string> = {
  default: "Quiet neutrals, lets the data speak",
  pasture: "Deep greens on warm paper",
  honey: "Amber and cream, walnut text",
  dairy: "Cool blue-grey, high clarity",
  midnight: "Deep slate, low glare",
  terracotta: "Clay and sand, olive accents",
};

function PresetCard({
  preset,
  active,
  onSelect,
}: {
  preset: ThemePreset;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-3 text-start transition-colors",
        "hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring",
        active && "border-ring ring-2 ring-ring/30",
      )}
    >
      <span aria-hidden data-theme={preset} className="flex gap-1.5">
        <span className="size-4 rounded-full border border-border bg-background" />
        <span className="size-4 rounded-full bg-primary" />
        <span className="size-4 rounded-full bg-accent" />
        <span className="size-4 rounded-full bg-chart-1" />
      </span>
      <span className="text-sm font-medium">{PRESET_LABELS[preset]}</span>
      <span className="text-xs text-muted-foreground">{PRESET_DESCRIPTIONS[preset]}</span>
    </button>
  );
}

const emptySubscribe = () => () => {};

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const { preset, setPreset, density, setDensity, direction, setDirection } = usePreferences();
  // useTheme() is undefined during SSR; only trust it after hydration so the
  // selected state never flashes wrong.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <section className="flex flex-col gap-3">
        <Label className="text-base">Mode</Label>
        <p className="text-sm text-muted-foreground">
          Dark mode pairs with every palette below.
        </p>
        <ToggleGroup
          type="single"
          variant="outline"
          value={mounted ? (theme ?? "system") : undefined}
          onValueChange={(value) => {
            if (value) setTheme(value);
          }}
          className="w-fit"
        >
          <ToggleGroupItem value="light" className="gap-2 px-4">
            <Sun className="size-4" /> Light
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" className="gap-2 px-4">
            <Moon className="size-4" /> Dark
          </ToggleGroupItem>
          <ToggleGroupItem value="system" className="gap-2 px-4">
            <Monitor className="size-4" /> System
          </ToggleGroupItem>
        </ToggleGroup>
      </section>

      <section className="flex flex-col gap-3">
        <Label className="text-base">Palette</Label>
        <p className="text-sm text-muted-foreground">
          Every palette passes WCAG AA in both modes — charts recolour to match.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEME_PRESETS.map((p) => (
            <PresetCard
              key={p}
              preset={p}
              active={preset === p}
              onSelect={() => setPreset(p)}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Label className="text-base">Density</Label>
        <p className="text-sm text-muted-foreground">
          Compact tightens tables and lists for large screens.
        </p>
        <ToggleGroup
          type="single"
          variant="outline"
          value={density}
          onValueChange={(value) => {
            if (value) setDensity(value as Density);
          }}
          className="w-fit"
        >
          {DENSITIES.map((d) => (
            <ToggleGroupItem key={d} value={d} className="px-4 capitalize">
              {d}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>

      <section className="flex flex-col gap-3">
        <Label className="text-base">Direction</Label>
        <p className="text-sm text-muted-foreground">
          The layout is built with logical properties, so right-to-left flips
          the whole interface.
        </p>
        <ToggleGroup
          type="single"
          variant="outline"
          value={direction}
          onValueChange={(value) => {
            if (value) setDirection(value as Direction);
          }}
          className="w-fit"
        >
          {DIRECTIONS.map((d) => (
            <ToggleGroupItem key={d} value={d} className="px-4 uppercase">
              {d}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>
    </div>
  );
}
