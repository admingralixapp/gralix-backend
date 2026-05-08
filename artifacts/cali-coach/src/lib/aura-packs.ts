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
];

export function getPackById(id: string): AuraPack | undefined {
  return AURA_PACKS.find((p) => p.id === id);
}

export const PAID_PACKS = AURA_PACKS.filter((p) => !p.free);
