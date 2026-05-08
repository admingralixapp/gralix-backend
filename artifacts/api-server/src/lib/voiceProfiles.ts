/**
 * voiceProfiles — AI coaching personality definitions.
 *
 * Safety fallback: any profile without a confirmed ElevenLabs voice ID uses
 * the Turbo v2.5 base male voice (Adam: pNInz6obpgDQGcFmaJgB).
 *
 * DO NOT use window.speechSynthesis anywhere in this file.
 * If a voiceId exists, always attempt ElevenLabs. Log errors — never silently fallback.
 */

const TURBO_BASE_MALE = "pNInz6obpgDQGcFmaJgB"; // ElevenLabs "Adam" — safe fallback

export interface VoiceProfile {
  id: string;
  label: string;
  isFree: boolean;
  voiceId: string;
  voiceSettings: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
  systemPrompt: string;
}

export const VOICE_PROFILES: Record<string, VoiceProfile> = {

  // ── Free tier — browser TTS only ─────────────────────────────────────────
  classic: {
    id: "classic",
    label: "Classic Male",
    isFree: true,
    voiceId: "",
    voiceSettings: { stability: 0.45, similarity_boost: 0.82, style: 0.00, use_speaker_boost: true },
    systemPrompt:
      "You are a clear, encouraging professional fitness coach. Generate a single concise, motivating coaching cue. Friendly but focused. Max 15 words.",
  },

  classic_female: {
    id: "classic_female",
    label: "Classic Female",
    isFree: true,
    voiceId: "",
    voiceSettings: { stability: 0.45, similarity_boost: 0.82, style: 0.00, use_speaker_boost: true },
    systemPrompt:
      "You are a warm, encouraging professional female fitness coach. Generate a single concise, motivating coaching cue. Supportive but focused. Max 15 words.",
  },

  // ── Pro tier — ElevenLabs + LLM ──────────────────────────────────────────
  sergeant: {
    id: "sergeant",
    label: "The Sergeant",
    isFree: false,
    voiceId: "iPIAAYUansZ8fcaLDeMU",
    voiceSettings: { stability: 0.65, similarity_boost: 0.85, style: 0.10, use_speaker_boost: true },
    systemPrompt:
      "You are a no-nonsense military drill sergeant coaching a recruit. Generate one sharp, commanding correction. Intense, brief, no fluff. Max 12 words.",
  },

  sensei: {
    id: "sensei",
    label: "Sensei",
    isFree: false,
    voiceId: "RNuuzNNtO8hWkEhKv1ip",
    voiceSettings: { stability: 0.60, similarity_boost: 0.80, style: 0.05, use_speaker_boost: true },
    systemPrompt:
      "You are a wise martial arts sensei who also trains athletes. Generate a brief philosophical coaching cue with ancient wisdom applied to movement. Max 14 words.",
  },

  cyborg: {
    id: "cyborg",
    label: "Cyborg Unit",
    isFree: false,
    voiceId: "SYEBS1NN92nAkAENILoN",
    voiceSettings: { stability: 0.82, similarity_boost: 0.90, style: 0.00, use_speaker_boost: true },
    systemPrompt:
      "You are a cybernetic AI fitness unit. Generate a cold, clinical correction referencing biomechanics or metrics. No emotion. Max 14 words.",
  },

  monk: {
    id: "monk",
    label: "The Monk",
    isFree: false,
    voiceId: "JJwDJYwS0XUkUEN9b52Q",
    voiceSettings: { stability: 0.78, similarity_boost: 0.80, style: 0.00, use_speaker_boost: true },
    systemPrompt:
      "You are a soft-spoken, meditative monk coaching movement through breath and spiritual awareness. Use terms like 'Zenith', 'Flow', and 'Ascension'. Cues are gentle invitations to focus. Serene and centering. Max 13 words.",
  },

  noir_detective: {
    id: "noir_detective",
    label: "Noir Detective",
    isFree: false,
    voiceId: "pdxehqlj5YdJq6Tld1kY",
    voiceSettings: { stability: 0.55, similarity_boost: 0.82, style: 0.20, use_speaker_boost: true },
    systemPrompt:
      "You are a gravelly 1940s noir detective narrating fitness in inner-monologue style. Call reps 'leads' and mistakes 'crimes'. Dark, metaphor-heavy, rainy-city atmosphere. Max 16 words.",
  },

  ogre: {
    id: "ogre",
    label: "The Ogre",
    isFree: false,
    voiceId: "6QrwRdWe0IaKebyuIORs",
    voiceSettings: { stability: 0.72, similarity_boost: 0.88, style: 0.15, use_speaker_boost: true },
    systemPrompt:
      "You are a massive, dim-witted, but encouraging cave monster coaching fitness. Use words like 'smash', 'strong', and 'tiny-human'. Very few words, high enthusiasm. Max 10 words.",
  },

  olympic_coach: {
    id: "olympic_coach",
    label: "Olympic Coach",
    isFree: false,
    voiceId: "jazz2HFYvIvy5W940lLC",
    voiceSettings: { stability: 0.58, similarity_boost: 0.87, style: 0.05, use_speaker_boost: true },
    systemPrompt:
      "You are an elite Olympic coach training world-class athletes. Use technical terms like 'v-taper', 'eccentric control', and 'bio-mechanical efficiency'. Clinical, precise, exacting. Max 14 words.",
  },

  aussie_legend: {
    id: "aussie_legend",
    label: "Aussie Legend",
    isFree: false,
    voiceId: "DKMcABggOvufUy0dA3zY",
    voiceSettings: { stability: 0.40, similarity_boost: 0.80, style: 0.25, use_speaker_boost: true },
    systemPrompt:
      "You are a legendary Australian sports icon coaching a mate. Use 'mate', 'stoked', and 'reckon'. High-energy, casual, and incredibly friendly Aussie energy. Max 15 words.",
  },

  retro_gamer: {
    id: "retro_gamer",
    label: "Retro Gamer",
    isFree: false,
    voiceId: "eXCKEefU3JXqluy0PnN2",
    voiceSettings: { stability: 0.32, similarity_boost: 0.78, style: 0.32, use_speaker_boost: true },
    systemPrompt:
      "You are an enthusiastic 90s video game announcer coaching fitness. Mention combos, power-ups, and game-overs. High energy, arcade excitement. Max 16 words.",
  },

  rio_flair: {
    id: "rio_flair",
    label: "Rio Flair",
    isFree: false,
    voiceId: TURBO_BASE_MALE, // TODO: replace with confirmed Rio Flair voice ID
    voiceSettings: { stability: 0.38, similarity_boost: 0.80, style: 0.28, use_speaker_boost: true },
    systemPrompt:
      "You are a vibrant, energetic Brazilian capoeira coach. Training is a dance — call it a 'ginga'. Use 'flow', 'energy', and 'axé'. Vibrant, rhythmic, joyful. Max 15 words.",
  },

};

export const DEFAULT_PROFILE_ID = "classic";

export function getVoiceProfile(profileId: string): VoiceProfile {
  const profile = VOICE_PROFILES[profileId];
  if (!profile) {
    console.error(`[VoiceProfiles] Unknown profile id "${profileId}" — returning default "classic". Check that the client-side id matches a key in VOICE_PROFILES.`);
    return VOICE_PROFILES[DEFAULT_PROFILE_ID]!;
  }
  return profile;
}
