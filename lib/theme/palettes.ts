// Color palette registry. Each palette remaps the app accent (teal scale) via
// the [data-palette="id"] CSS rules in globals.css. Stored per-device.

export const PALETTE_STORAGE_KEY = "fishing_pos_palette";

export type PaletteId =
  | "teal"
  | "forest"
  | "sage"
  | "ocean"
  | "turquoise"
  | "taxi"
  | "sunset"
  | "crimson"
  | "pastel";

export type Palette = {
  id: PaletteId;
  label: string;
  description: string;
  /** Representative swatches for the picker preview (light → dark). */
  swatches: string[];
  /** The dominant accent shown on the selected ring / dot. */
  accent: string;
};

export const PALETTES: Palette[] = [
  {
    id: "teal",
    label: "Teal",
    description: "Warna bawaan sistem",
    swatches: ["#ccfbf1", "#5eead4", "#14b8a6", "#0d9488", "#115e59"],
    accent: "#0d9488",
  },
  {
    id: "forest",
    label: "Forest",
    description: "Hijau pinus, kalem & elegan",
    swatches: ["#daf1de", "#8eb69b", "#235347", "#163832", "#051f20"],
    accent: "#235347",
  },
  {
    id: "sage",
    label: "Blush Sage",
    description: "Lembut & netral",
    swatches: ["#f1f7f7", "#d5e5e5", "#bdd7d8", "#8aa1a1", "#5d6b6b"],
    accent: "#5d6b6b",
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Biru laut yang tenang",
    swatches: ["#c1e8ff", "#7da0ca", "#5483b3", "#052659", "#021024"],
    accent: "#5483b3",
  },
  {
    id: "turquoise",
    label: "Turquoise",
    description: "Toska cerah & segar",
    swatches: ["#d8d7ce", "#67d4e3", "#00a6c0", "#283b48", "#222831"],
    accent: "#00a6c0",
  },
  {
    id: "taxi",
    label: "Taxi",
    description: "Kuning emas, berani",
    swatches: ["#fff3bf", "#ffe066", "#f1c40f", "#b8860b", "#262b32"],
    accent: "#d4a017",
  },
  {
    id: "sunset",
    label: "Sunset",
    description: "Oranye hangat",
    swatches: ["#ffe3b3", "#fbb931", "#f88f22", "#ea6113", "#8a3a0a"],
    accent: "#ea6113",
  },
  {
    id: "crimson",
    label: "Crimson",
    description: "Merah berani",
    swatches: ["#ffd9cc", "#ff8a66", "#e23b3b", "#b51a2b", "#541a28"],
    accent: "#b51a2b",
  },
  {
    id: "pastel",
    label: "Pastel Dream",
    description: "Lavender lembut",
    swatches: ["#f4e7fb", "#e3aadd", "#c8a8e9", "#a06fd0", "#6b3fa0"],
    accent: "#a06fd0",
  },
];

export const DEFAULT_PALETTE: PaletteId = "teal";

export function isPaletteId(value: string | null | undefined): value is PaletteId {
  return !!value && PALETTES.some((p) => p.id === value);
}

/** Apply a palette to <html> (all palettes, incl. default teal, tint surfaces). */
export function applyPalette(id: PaletteId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-palette", id);
}

export function readStoredPalette(): PaletteId {
  if (typeof window === "undefined") return DEFAULT_PALETTE;
  try {
    const v = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    return isPaletteId(v) ? v : DEFAULT_PALETTE;
  } catch {
    return DEFAULT_PALETTE;
  }
}

export function storePalette(id: PaletteId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PALETTE_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
