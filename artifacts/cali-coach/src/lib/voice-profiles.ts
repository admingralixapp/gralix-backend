/**
 * voice-profiles — Client-side voice personality definitions.
 *
 * Mirrors the backend voiceProfiles but only the fields the frontend needs
 * (no API keys / ElevenLabs voice IDs are exposed to the client).
 *
 * isFree = true  → browser Web Speech API (no ElevenLabs call, no cost)
 * isFree = false → ElevenLabs + LLM personality injection (Pro feature)
 */

export interface VoiceProfileMeta {
  id: string;
  label: string;
  description: string;
  emoji: string;
  isFree: boolean;
}

export const VOICE_PROFILE_LIST: VoiceProfileMeta[] = [
  // ── Free tier ─────────────────────────────────────────────────────────────
  {
    id: "classic",
    label: "Classic Male",
    description: "Clear, encouraging — browser voice",
    emoji: "🏋️",
    isFree: true,
  },
  {
    id: "classic_female",
    label: "Classic Female",
    description: "Warm, supportive — browser voice",
    emoji: "👩‍🏫",
    isFree: true,
  },

  // ── Pro tier — ElevenLabs AI personalities ────────────────────────────────
  {
    id: "sergeant",
    label: "The Sergeant",
    description: "Military drill sergeant — intense, no excuses",
    emoji: "🪖",
    isFree: false,
  },
  {
    id: "sensei",
    label: "Sensei",
    description: "Ancient wisdom applied to modern movement",
    emoji: "🥷",
    isFree: false,
  },
  {
    id: "cyborg",
    label: "Cyborg Unit",
    description: "Cold, clinical AI — biomechanics & metrics",
    emoji: "🤖",
    isFree: false,
  },
  {
    id: "monk",
    label: "The Monk",
    description: "Zenith, Flow, Ascension — breathe your form",
    emoji: "🧘",
    isFree: false,
  },
  {
    id: "noir_detective",
    label: "Noir Detective",
    description: "Every rep is a lead. Every mistake, a crime.",
    emoji: "🕵️",
    isFree: false,
  },
  {
    id: "ogre",
    label: "The Ogre",
    description: "Primal power, maximum brace — very few words",
    emoji: "👹",
    isFree: false,
  },
  {
    id: "olympic_coach",
    label: "Olympic Coach",
    description: "V-taper, eccentric control, bio-mechanical efficiency",
    emoji: "🥇",
    isFree: false,
  },
  {
    id: "aussie_legend",
    label: "Aussie Legend",
    description: "Mate, you're stoked — reckon you've got this!",
    emoji: "🦘",
    isFree: false,
  },
  {
    id: "retro_gamer",
    label: "Retro Gamer",
    description: "Level Up your HP — activate those Buffs!",
    emoji: "🎮",
    isFree: false,
  },
  {
    id: "tokyo_tech",
    label: "Tokyo Tech",
    description: "High-tech precision coaching, formally efficient",
    emoji: "🗼",
    isFree: false,
  },
];

export const FREE_PROFILES = new Set(
  VOICE_PROFILE_LIST.filter((p) => p.isFree).map((p) => p.id),
);

export const DEFAULT_VOICE_PROFILE_ID = "classic";

export function getVoiceProfileMeta(id: string): VoiceProfileMeta {
  return (
    VOICE_PROFILE_LIST.find((p) => p.id === id) ??
    VOICE_PROFILE_LIST[0]!
  );
}
