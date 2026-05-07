export interface AuraPack {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  voiceId: string;
  skinId: string;
  price: string;
  priceAmount: number;
  free: boolean;
  gradient: string;
  accentColor: string;
}

export const AURA_PACKS: AuraPack[] = [
  {
    id: "classic",
    name: "Classic Aura",
    tagline: "The default CaliCoach experience",
    emoji: "👻",
    voiceId: "classic",
    skinId: "classic",
    price: "Free",
    priceAmount: 0,
    free: true,
    gradient: "linear-gradient(135deg, rgba(0,212,255,0.12) 0%, rgba(0,212,255,0.04) 100%)",
    accentColor: "#00d4ff",
  },
  {
    id: "iron-circuit",
    name: "Iron Circuit",
    tagline: "Military intensity meets electric neon",
    emoji: "🪖",
    voiceId: "drill-sergeant",
    skinId: "neon-wireframe",
    price: "£4.99",
    priceAmount: 4.99,
    free: false,
    gradient: "linear-gradient(135deg, rgba(57,255,20,0.12) 0%, rgba(57,255,20,0.04) 100%)",
    accentColor: "#39ff14",
  },
  {
    id: "zen-garden",
    name: "Zen Garden",
    tagline: "Calm mind, ethereal presence",
    emoji: "🧘",
    voiceId: "zen",
    skinId: "spirit-aura",
    price: "£4.99",
    priceAmount: 4.99,
    free: false,
    gradient: "linear-gradient(135deg, rgba(168,85,247,0.14) 0%, rgba(168,85,247,0.04) 100%)",
    accentColor: "#a855f7",
  },
  {
    id: "hype-storm",
    name: "Hype Storm",
    tagline: "Explosive energy, blazing form",
    emoji: "🔥",
    voiceId: "hype",
    skinId: "plasma-storm",
    price: "£4.99",
    priceAmount: 4.99,
    free: false,
    gradient: "linear-gradient(135deg, rgba(249,115,22,0.14) 0%, rgba(249,115,22,0.04) 100%)",
    accentColor: "#f97316",
  },
];

export function getPackById(id: string): AuraPack | undefined {
  return AURA_PACKS.find((p) => p.id === id);
}

export const PAID_PACKS = AURA_PACKS.filter((p) => !p.free);
