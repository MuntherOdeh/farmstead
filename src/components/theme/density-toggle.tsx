"use client";

import { Rows2, Rows4 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePreferences } from "@/components/theme/theme-provider";

export function DensityToggle() {
  const { density, setDensity } = usePreferences();
  const next = density === "comfortable" ? "compact" : "comfortable";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={() => setDensity(next)}>
          {density === "comfortable" ? (
            <Rows2 className="size-4" />
          ) : (
            <Rows4 className="size-4" />
          )}
          <span className="sr-only">Switch to {next} density</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Density: {density}</TooltipContent>
    </Tooltip>
  );
}
