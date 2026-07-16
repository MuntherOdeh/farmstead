/*
 * WCAG AA gate for every Farmstead theme (SPEC §10).
 *
 * Parses src/styles/themes.css, reconstructs each effective theme the way the
 * CSS cascade does (mode class × data-theme preset), and fails the build if:
 *   - any text pair drops below 4.5:1
 *   - any UI pair (focus ring, control fills, chart marks on cards) drops
 *     below 3:1
 *   - any hairline (border/input) drops below a 1.3:1 visibility floor
 *   - the categorical chart palette becomes indistinguishable, for normal
 *     vision or under simulated deuteranopia (Machado et al. 2009, severity 1)
 *
 * Note on borders: WCAG 1.4.11 requires 3:1 only for visuals needed to
 * identify a component (focus indicators, control boundaries) — decorative
 * card/table hairlines are exempt, so those get the visibility floor instead
 * while ring and fills get the full 3:1.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { converter, parse, wcagContrast, type Color } from "culori";

const THEMES_CSS = join(process.cwd(), "src", "styles", "themes.css");
const PRESETS = ["pasture", "honey", "dairy", "midnight", "terracotta"] as const;

const TEXT_MIN = 4.5;
const UI_MIN = 3.0;
const HAIRLINE_MIN = 1.3;
// Floors follow the dataviz palette validator: normal-vision ΔE(OKLab) ≥ 0.15
// is a hard fail below, CVD-simulated ΔE ≥ 0.08 keeps adjacent series apart
// for deuteranopes without needing secondary encoding.
const CHART_DELTA_E_MIN = 0.15;
const CHART_CVD_DELTA_E_MIN = 0.08;

const TEXT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["foreground", "background"],
  ["foreground", "muted"],
  ["foreground", "secondary"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["destructive-foreground", "destructive"],
  ["destructive", "background"],
  ["destructive", "card"],
  ["destructive", "popover"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["sidebar-accent-foreground", "sidebar-accent"],
];

const UI_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["ring", "background"],
  ["primary", "background"],
  ["sidebar-ring", "sidebar"],
  ["chart-1", "card"],
  ["chart-2", "card"],
  ["chart-3", "card"],
  ["chart-4", "card"],
  ["chart-5", "card"],
];

const HAIRLINE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["border", "background"],
  ["input", "background"],
  ["sidebar-border", "sidebar"],
];

const REQUIRED_TOKENS = [
  ...new Set(
    [...TEXT_PAIRS, ...UI_PAIRS, ...HAIRLINE_PAIRS].flatMap((pair) => [...pair]),
  ),
];

type TokenMap = Map<string, string>;

function parseBlocks(css: string): Map<string, TokenMap> {
  const blocks = new Map<string, TokenMap>();
  const blockRe = /(^|\n)\s*([^{}\n/][^{}\n]*)\{([^}]*)\}/g;
  for (const match of css.matchAll(blockRe)) {
    const tokens: TokenMap = new Map();
    for (const decl of match[3].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      tokens.set(decl[1], decl[2].trim());
    }
    if (tokens.size === 0) continue;
    // Comma-grouped selectors (e.g. `:root, [data-theme="default"]`) share
    // one token set — register each part so lookups stay exact.
    for (const part of match[2].split(",")) {
      blocks.set(part.trim(), tokens);
    }
  }
  return blocks;
}

function mergeThemes(blocks: Map<string, TokenMap>): Map<string, TokenMap> {
  const root = blocks.get(":root");
  const dark = blocks.get(".dark");
  if (!root || !dark) throw new Error("themes.css must define :root and .dark");

  const themes = new Map<string, TokenMap>();
  themes.set("default light", new Map(root));
  themes.set("default dark", new Map([...root, ...dark]));

  for (const preset of PRESETS) {
    const light = blocks.get(`[data-theme="${preset}"]`);
    const presetDark = blocks.get(`.dark[data-theme="${preset}"]`);
    if (!light || !presetDark) {
      throw new Error(`missing light or dark block for preset "${preset}"`);
    }
    themes.set(`${preset} light`, new Map([...root, ...light]));
    themes.set(`${preset} dark`, new Map([...root, ...dark, ...presetDark]));
  }
  return themes;
}

const toRgb = converter("rgb");
const toLrgb = converter("lrgb");
const toOklab = converter("oklab");

/** Composite a possibly-translucent color over an opaque backdrop, in sRGB. */
function flatten(value: string, backdrop: string): Color {
  const fg = toRgb(parse(value));
  const bg = toRgb(parse(backdrop));
  if (!fg || !bg) throw new Error(`unparseable color: ${value} / ${backdrop}`);
  const alpha = fg.alpha ?? 1;
  if (alpha >= 1) return fg;
  return {
    mode: "rgb",
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
  };
}

function contrast(theme: TokenMap, fgToken: string, bgToken: string): number {
  const bgRaw = theme.get(bgToken);
  const fgRaw = theme.get(fgToken);
  if (!bgRaw || !fgRaw) throw new Error(`missing token: ${fgToken} or ${bgToken}`);
  // Backdrops with alpha (none today) would themselves sit on --background.
  const bg = flatten(bgRaw, theme.get("background") ?? "#fff");
  const fg = flatten(fgRaw, bgRaw);
  return wcagContrast(fg, bg);
}

/** Machado et al. 2009 deuteranopia (severity 1.0) on linear RGB. */
function deuteranopia(value: string): Color {
  const c = toLrgb(parse(value));
  if (!c) throw new Error(`unparseable color: ${value}`);
  const { r, g, b } = c;
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return {
    mode: "lrgb",
    r: clamp(0.367322 * r + 0.860646 * g + -0.227968 * b),
    g: clamp(0.280085 * r + 0.672501 * g + 0.047413 * b),
    b: clamp(-0.01182 * r + 0.04294 * g + 0.968881 * b),
  };
}

function deltaE(a: Color, b: Color): number {
  const la = toOklab(a);
  const lb = toOklab(b);
  return Math.hypot(la.l - lb.l, (la.a ?? 0) - (lb.a ?? 0), (la.b ?? 0) - (lb.b ?? 0));
}

interface Failure {
  theme: string;
  check: string;
  actual: number;
  required: number;
}

const failures: Failure[] = [];
const css = readFileSync(THEMES_CSS, "utf8");
const themes = mergeThemes(parseBlocks(css));

for (const [name, tokens] of themes) {
  for (const token of REQUIRED_TOKENS) {
    if (!tokens.has(token)) {
      failures.push({ theme: name, check: `token --${token} missing`, actual: 0, required: 1 });
    }
  }
  if (failures.some((f) => f.theme === name)) continue;

  const run = (
    pairs: ReadonlyArray<readonly [string, string]>,
    min: number,
    kind: string,
  ) => {
    for (const [fg, bg] of pairs) {
      const ratio = contrast(tokens, fg, bg);
      if (ratio < min) {
        failures.push({
          theme: name,
          check: `${kind} --${fg} on --${bg}`,
          actual: ratio,
          required: min,
        });
      }
    }
  };
  run(TEXT_PAIRS, TEXT_MIN, "text");
  run(UI_PAIRS, UI_MIN, "ui");
  run(HAIRLINE_PAIRS, HAIRLINE_MIN, "hairline");

  // shadcn's destructive buttons/badges render --destructive as TEXT over a
  // 10% (light) / 20% (dark) wash of itself on the page background.
  {
    const softAlpha = name.endsWith("dark") ? 0.2 : 0.1;
    const destructiveRaw = tokens.get("destructive");
    const backgroundRaw = tokens.get("background");
    if (destructiveRaw && backgroundRaw) {
      const d = toRgb(parse(destructiveRaw));
      if (!d) throw new Error(`unparseable color: ${destructiveRaw}`);
      const softBg = flatten(backgroundRaw, "#fff");
      const wash: Color = {
        mode: "rgb",
        r: d.r * softAlpha + (softBg as { r: number }).r * (1 - softAlpha),
        g: d.g * softAlpha + (softBg as { g: number }).g * (1 - softAlpha),
        b: d.b * softAlpha + (softBg as { b: number }).b * (1 - softAlpha),
      };
      const ratio = wcagContrast(d, wash);
      if (ratio < TEXT_MIN) {
        failures.push({
          theme: name,
          check: `text --destructive on its ${softAlpha * 100}% wash`,
          actual: ratio,
          required: TEXT_MIN,
        });
      }
    }
  }

  const chartTokens = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];
  for (let i = 0; i < chartTokens.length; i++) {
    for (let j = i + 1; j < chartTokens.length; j++) {
      const rawA = tokens.get(chartTokens[i]);
      const rawB = tokens.get(chartTokens[j]);
      if (!rawA || !rawB) continue;
      const normal = deltaE(parse(rawA) as Color, parse(rawB) as Color);
      if (normal < CHART_DELTA_E_MIN) {
        failures.push({
          theme: name,
          check: `palette --${chartTokens[i]} vs --${chartTokens[j]} (normal vision)`,
          actual: normal,
          required: CHART_DELTA_E_MIN,
        });
      }
      const cvd = deltaE(deuteranopia(rawA), deuteranopia(rawB));
      if (cvd < CHART_CVD_DELTA_E_MIN) {
        failures.push({
          theme: name,
          check: `palette --${chartTokens[i]} vs --${chartTokens[j]} (deuteranopia)`,
          actual: cvd,
          required: CHART_CVD_DELTA_E_MIN,
        });
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`✗ ${failures.length} contrast failure(s):\n`);
  for (const f of failures) {
    console.error(
      `  [${f.theme}] ${f.check}: ${f.actual.toFixed(3)} (needs ≥ ${f.required})`,
    );
  }
  process.exit(1);
}

console.log(`✓ ${themes.size} themes pass WCAG AA (text ${TEXT_MIN}:1, UI ${UI_MIN}:1) and CVD palette checks.`);
