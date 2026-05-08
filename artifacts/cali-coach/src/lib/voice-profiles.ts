/**
 * voice-profiles — Client-side voice personality definitions.
 *
 * Mirrors the backend voiceProfiles but only the fields the frontend needs
 * (no API keys / voice IDs are exposed to the client).
 */

export interface VoiceProfileMeta {
  id: string;
  label: string;
  description: string;
  emoji: string;
}

export const VOICE_PROFILE_LIST: VoiceProfileMeta[] = [
  {
    id: "classic",
    label: "Classic Coach",
    description: "Clear, encouraging, professional",
    emoji: "🏋️",
  },
  {
    id: "sergeant",
    label: "The Sergeant",
    description: "Military drill sergeant — intense, no excuses",
    emoji: "🪖",
  },
  {
    id: "cyborg",
    label: "Cyborg Unit",
    description: "Cold, clinical AI — biomechanics & metrics",
    emoji: "🤖",
  },
  {
    id: "sensei",
    label: "Sensei",
    description: "Ancient wisdom applied to modern movement",
    emoji: "🥷",
  },
  {
    id: "monk",
    label: "The Monk",
    description: "Breathwork & mindfulness — serene and centering",
    emoji: "🧘",
  },
  {
    id: "noir_detective",
    label: "Noir Detective",
    description: "Hard-boiled grit and metaphor",
    emoji: "🕵️",
  },
  {
    id: "retro_gamer",
    label: "Retro Gamer",
    description: "XP, level-ups, and boss battle energy",
    emoji: "🎮",
  },
  {
    id: "olympic_coach",
    label: "Olympic Coach",
    description: "Elite precision coaching for peak performance",
    emoji: "🥇",
  },
  {
    id: "ppowerlifter",
    label: "The Powerlifter",
    description: "Raw strength, blue-collar tough love",
    emoji: "💪",
  },
  {
    id: "tokyo_tech",
    label: "Tokyo Tech",
    description: "High-tech, precise, formally efficient",
    emoji: "🗼",
  },
  {
    id: "aussie_legend",
    label: "Aussie Legend",
    description: "Friendly, enthusiastic, mate-energy",
    emoji: "🦘",
  },
];

export const DEFAULT_VOICE_PROFILE_ID = "classic";

export function getVoiceProfileMeta(id: string): VoiceProfileMeta {
  return (
    VOICE_PROFILE_LIST.find((p) => p.id === id) ??
    VOICE_PROFILE_LIST[0]!
  );
}
