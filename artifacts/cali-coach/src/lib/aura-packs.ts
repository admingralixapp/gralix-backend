export interface AuraPack {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  /** Voice profile ID — must exactly match a key in backend VOICE_PROFILES */
  voiceId: string;
  /** Ghost skeleton colour theme name */
  skinId: string;
  /** Ghost skeleton CSS colour for rendering */
  skinColor: string;
  price: string;
  priceAmount: number;
  free: boolean;
  gradient: string;
  accentColor: string;
}

export const AURA_PACKS: AuraPack[] = [
  // ── Free packs ────────────────────────────────────────────────────────────
  {
    id: "classic",
    name: "Classic Aura",
    tagline: "The default CaliCoach experience",
    emoji: "👻",
    voiceId: "classic",
    skinId: "classic",
    skinColor: "#00d4ff",
    price: "Free",
    priceAmount: 0,
    free: true,
    gradient: "linear-gradient(135deg, rgba(0,212,255,0.12) 0%, rgba(0,212,255,0.04) 100%)",
    accentColor: "#00d4ff",
  },
  {
    id: "classic_female",
    name: "Classic Female Aura",
    tagline: "Warm, supportive coaching — browser voice",
    emoji: "👩‍🏫",
    voiceId: "classic_female",
    skinId: "classic-rose",
    skinColor: "#f472b6",
    price: "Free",
    priceAmount: 0,
    free: true,
    gradient: "linear-gradient(135deg, rgba(244,114,182,0.12) 0%, rgba(244,114,182,0.04) 100%)",
    accentColor: "#f472b6",
  },

  // ── Paid packs ────────────────────────────────────────────────────────────
  {
    id: "sergeant",
    name: "Iron Sergeant",
    tagline: "Military precision — no mercy, all results",
    emoji: "🪖",
    voiceId: "sergeant",
    skinId: "military-shadow",
    skinColor: "#4a7c59",
    price: "£4.99",
    priceAmount: 4.99,
    free: false,
    gradient: "linear-gradient(135deg, rgba(74,124,89,0.20) 0%, rgba(74,124,89,0.06) 100%)",
    accentColor: "#4a7c59",
  },
  {
    id: "sensei",
    name: "Sensei",
    tagline: "Ancient wisdom for modern movement",
    emoji: "🥷",
    voiceId: "sensei",
    skinId: "midnight-blue",
    skinColor: "#6366f1",
    price: "£4.99",
    priceAmount: 4.99,
    free: false,
    gradient: "linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0.05) 100%)",
    accentColor: "#6366f1",
  },
  {
    id: "cyborg",
    name: "Cyborg Unit",
    tagline: "Cold clinical AI — biomechanics & metrics",
    emoji: "🤖",
    voiceId: "cyborg",
    skinId: "chrome-pulse",
    skinColor: "#06b6d4",
    price: "£4.99",
    priceAmount: 4.99,
    free: false,
    gradient: "linear-gradient(135deg, rgba(6,182,212,0.18) 0%, rgba(6,182,212,0.05) 100%)",
    accentColor: "#06b6d4",
  },
  {
    id: "monk",
    name: "The Monk",
    tagline: "Zenith, Flow, Ascension — breathe your form",
    emoji: "🧘",
    voiceId: "monk",
    skinId: "pearl-mist",
    skinColor: "#c4b5fd",
    price: "£4.99",
    priceAmount: 4.99,
    free: false,
    gradient: "linear-gradient(135deg, rgba(196,181,253,0.18) 0%, rgba(196,181,253,0.05) 100%)",
    accentColor: "#c4b5fd",
  },
  {
    id: "noir_detective",
    name: "Noir Detective",
    tagline: "Every rep is a lead. Every mistake, a crime.",
    emoji: "🕵️",
    voiceId: "noir_detective",
    skinId: "grey-shadow",
    skinColor: "#9ca3af",
    price: "£4.99",
    priceAmount: 4.99,
    free: false,
    gradient: "linear-gradient(135deg, rgba(107,114,128,0.22) 0%, rgba(107,114,128,0.06) 100%)",
    accentColor: "#9ca3af",
  },
  {
    id: "ogre",
    name: "The Ogre",
    tagline: "Smash strong, tiny-human — cave monster hype",
    emoji: "👹",
    voiceId: "ogre",
    skinId: "iron-ore",
    skinColor: "#f97316",
    price: "£4.99",
    priceAmount: 4.99,
    free: false,
    gradient: "linear-gradient(135deg, rgba(249,115,22,0.18) 0%, rgba(249,115,22,0.05) 100%)",
    accentColor: "#f97316",
  },
  {
    id: "olympic_coach",
    name: "Olympic Coach",
    tagline: "V-taper, eccentric control, peak efficiency",
    emoji: "🥇",
    voiceId: "olympic_coach",
    skinId: "gold-standard",
    skinColor: "#eab308",
    price: "£4.99",
    priceAmount: 4.99,
    free: false,
    gradient: "linear-gradient(135deg, rgba(234,179,8,0.18) 0%, rgba(234,179,8,0.05) 100%)",
    accentColor: "#eab308",
  },
  {
    id: "aussie_legend",
    name: "Aussie Legend",
    tagline: "Mate, you're stoked — reckon you've got this!",
    emoji: "🦘",
    voiceId: "aussie_legend",
    skinId: "coral-blaze",
    skinColor: "#fb923c",
    price: "£4.99",
    priceAmount: 4.99,
    free: false,
    gradient: "linear-gradient(135deg, rgba(251,146,60,0.18) 0%, rgba(251,146,60,0.05) 100%)",
    accentColor: "#fb923c",
  },
  {
    id: "retro_gamer",
    name: "Retro Gamer",
    tagline: "90s game announcer — combos, power-ups, game-overs",
    emoji: "🎮",
    voiceId: "retro_gamer",
    skinId: "neon-surge",
    skinColor: "#e879f9",
    price: "£4.99",
    priceAmount: 4.99,
    free: false,
    gradient: "linear-gradient(135deg, rgba(232,121,249,0.18) 0%, rgba(232,121,249,0.05) 100%)",
    accentColor: "#e879f9",
  },
  {
    id: "tokyo_tech",
    name: "Tokyo Tech",
    tagline: "Neon-lit future AI — efficiency protocols, neural data",
    emoji: "🗼",
    voiceId: "tokyo_tech",
    skinId: "neon-tokyo",
    skinColor: "#00f5ff",
    price: "£4.99",
    priceAmount: 4.99,
    free: false,
    gradient: "linear-gradient(135deg, rgba(0,245,255,0.18) 0%, rgba(139,92,246,0.08) 100%)",
    accentColor: "#00f5ff",
  },
];

export function getPackById(id: string): AuraPack | undefined {
  return AURA_PACKS.find((p) => p.id === id);
}

export const PAID_PACKS = AURA_PACKS.filter((p) => !p.free);

/** Returns the ghost skeleton CSS colour for the currently active aura pack. */
export function getActiveGhostColor(activePackId: string): string {
  return getPackById(activePackId)?.skinColor ?? "#00d4ff";
}
