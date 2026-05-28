const SHOP_KEY = "calicoach_shop_v1";

export interface VoiceTone {
  id: string;
  label: string;
  description: string;
  emoji: string;
  free: boolean;
  price: string;
}

export interface GhostSkin {
  id: string;
  label: string;
  description: string;
  emoji: string;
  free: boolean;
  price: string;
  primaryColor: string;
}

export const VOICE_TONES: VoiceTone[] = [
  {
    id: "classic",
    label: "Classic Coach",
    description: "Balanced, encouraging guidance",
    emoji: "🎙️",
    free: true,
    price: "Free",
  },
  {
    id: "drill-sergeant",
    label: "Drill Sergeant",
    description: "Intense military-style motivation",
    emoji: "🪖",
    free: false,
    price: "£4.99",
  },
  {
    id: "zen",
    label: "Zen Coach",
    description: "Calm, mindful breathwork cues",
    emoji: "🧘",
    free: false,
    price: "£4.99",
  },
  {
    id: "hype",
    label: "Hype Machine",
    description: "High-energy, hypeman energy",
    emoji: "🔥",
    free: false,
    price: "£4.99",
  },
];

export const GHOST_SKINS: GhostSkin[] = [
  {
    id: "classic",
    label: "Classic Ghost",
    description: "Clean cyan skeleton overlay",
    emoji: "👻",
    free: true,
    price: "Free",
    primaryColor: "#00d4ff",
  },
  {
    id: "neon-wireframe",
    label: "Neon Wireframe",
    description: "Electric grid with glitch FX",
    emoji: "⚡",
    free: false,
    price: "£4.99",
    primaryColor: "#39ff14",
  },
  {
    id: "spirit-aura",
    label: "Spirit Voice",
    description: "Ethereal purple energy field",
    emoji: "✨",
    free: false,
    price: "£4.99",
    primaryColor: "#a855f7",
  },
  {
    id: "plasma-storm",
    label: "Plasma Storm",
    description: "Blazing fire and explosive energy",
    emoji: "🌋",
    free: false,
    price: "£4.99",
    primaryColor: "#f97316",
  },
];

interface ShopData {
  purchasedItems: string[];
  selectedVoice: string;
  selectedSkin: string;
}

function load(): ShopData {
  try {
    const raw = localStorage.getItem(SHOP_KEY);
    if (raw) return JSON.parse(raw) as ShopData;
  } catch {}
  return { purchasedItems: [], selectedVoice: "classic", selectedSkin: "classic" };
}

function save(data: ShopData): void {
  try {
    localStorage.setItem(SHOP_KEY, JSON.stringify(data));
  } catch {}
}

export function getShopData(): ShopData {
  return load();
}

export function isPurchased(itemId: string): boolean {
  const data = load();
  const freeIds = [...VOICE_TONES, ...GHOST_SKINS].filter(i => i.free).map(i => i.id);
  return freeIds.includes(itemId) || data.purchasedItems.includes(itemId);
}

export function purchaseItem(itemId: string): void {
  const data = load();
  if (!data.purchasedItems.includes(itemId)) {
    data.purchasedItems.push(itemId);
    save(data);
  }
}

export function getSelectedVoice(): string {
  return load().selectedVoice;
}

export function setSelectedVoice(id: string): void {
  const data = load();
  data.selectedVoice = id;
  save(data);
}

export function getSelectedSkin(): string {
  return load().selectedSkin;
}

export function setSelectedSkin(id: string): void {
  const data = load();
  data.selectedSkin = id;
  save(data);
}

const OPACITY_KEY = "calicoach_ghost_opacity_v1";

export function getGhostOpacity(): number {
  try {
    const v = parseFloat(localStorage.getItem(OPACITY_KEY) ?? "");
    if (!isNaN(v) && v >= 0.1 && v <= 1) return v;
  } catch {}
  return 0.75;
}

export function setGhostOpacity(v: number): void {
  try {
    localStorage.setItem(OPACITY_KEY, String(v));
  } catch {}
}
