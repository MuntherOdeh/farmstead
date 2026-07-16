"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { DensityToggle } from "@/components/theme/density-toggle";
import { ThemePicker } from "@/components/theme/theme-picker";

export function Topbar({ onOpenPalette }: { onOpenPalette: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/90 ps-3 pe-2 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <SidebarTrigger />
      <Separator orientation="vertical" className="me-1 data-[orientation=vertical]:h-4" />
      <Breadcrumbs />
      <div className="flex-1" />
      <Button
        variant="outline"
        onClick={onOpenPalette}
        className="hidden h-8 w-56 justify-between text-muted-foreground md:flex"
      >
        <span className="flex items-center gap-2 text-sm font-normal">
          <Search className="size-3.5" />
          Search…
        </span>
        <Kbd>Ctrl K</Kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenPalette}
        className="md:hidden"
      >
        <Search className="size-4" />
        <span className="sr-only">Search</span>
      </Button>
      <ThemePicker />
      <DensityToggle />
    </header>
  );
}
