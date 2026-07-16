"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export const THEME_PRESETS = [
  "default",
  "pasture",
  "honey",
  "dairy",
  "midnight",
  "terracotta",
] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];
export const PRESET_STORAGE_KEY = "farmstead-preset";

export const DENSITIES = ["comfortable", "compact"] as const;
export type Density = (typeof DENSITIES)[number];
const DENSITY_STORAGE_KEY = "farmstead-density";

/**
 * localStorage-backed preference exposed as an external store, so components
 * read it via useSyncExternalStore: the server snapshot is the default, the
 * client snapshot is the stored value, and React reconciles after hydration.
 * (The inline script in the root layout already applied the stored value to
 * <html> before first paint, so nothing flashes.)
 */
function createPreferenceStore<T extends string>(
  key: string,
  valid: readonly T[],
  fallback: T,
  applyToDom: (value: T) => void,
) {
  let cached: T | null = null;
  const listeners = new Set<() => void>();

  const read = (): T => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null && (valid as readonly string[]).includes(stored)
        ? (stored as T)
        : fallback;
    } catch {
      // Storage unavailable (private mode / blocked) — use the default.
      return fallback;
    }
  };

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: (): T => {
      if (cached === null) cached = read();
      return cached;
    },
    getServerSnapshot: (): T => fallback,
    set: (next: T) => {
      cached = next;
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Storage unavailable — the choice still applies for this session.
      }
      applyToDom(next);
      for (const listener of listeners) listener();
    },
  };
}

const presetStore = createPreferenceStore<ThemePreset>(
  PRESET_STORAGE_KEY,
  THEME_PRESETS,
  "default",
  (value) => {
    if (value === "default") {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = value;
    }
  },
);

const densityStore = createPreferenceStore<Density>(
  DENSITY_STORAGE_KEY,
  DENSITIES,
  "comfortable",
  (value) => {
    document.documentElement.dataset.density = value;
  },
);

interface PreferencesContextValue {
  preset: ThemePreset;
  setPreset: (preset: ThemePreset) => void;
  density: Density;
  setDensity: (density: Density) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used inside AppThemeProvider");
  }
  return ctx;
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const preset = useSyncExternalStore(
    presetStore.subscribe,
    presetStore.getSnapshot,
    presetStore.getServerSnapshot,
  );
  const density = useSyncExternalStore(
    densityStore.subscribe,
    densityStore.getSnapshot,
    densityStore.getServerSnapshot,
  );

  const setPreset = useCallback((next: ThemePreset) => presetStore.set(next), []);
  const setDensity = useCallback((next: Density) => densityStore.set(next), []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <PreferencesContext.Provider value={{ preset, setPreset, density, setDensity }}>
        {children}
      </PreferencesContext.Provider>
    </NextThemesProvider>
  );
}
