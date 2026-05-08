/**
 * voiceProfiles — AI coaching personality definitions.
 *
 * Each profile defines:
 *   • isFree        — true = browser TTS only (no ElevenLabs call)
 *   • voiceId       — ElevenLabs voice to use (ignored when isFree)
 *   • voice_settings — ElevenLabs generation tuning (ignored when isFree)
 *   • systemPrompt  — LLM system prompt to generate cues in-character
 */

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
  // ── Free tier — browser TTS only ──────────────────────────────────────────
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
    voiceId: "zcAOhNBS3c14rBihAFp1",
    voiceSettings: { stability: 0.75, similarity_boost: 0.78, style: 0.00, use_speaker_boost: true },
    systemPrompt:
      "You are a mindful monk who coaches movement through breath and stillness. Generate a serene, breathwork-centered cue. Calm and centering. Max 13 words.",
  },

  noir_detective: {
    id: "noir_detective",
    label: "Noir Detective",
    isFree: false,
    voiceId: "2EiwWnXFnvU5JabPnv8n",
    voiceSettings: { stability: 0.55, similarity_boost: 0.82, style: 0.18, use_speaker_boost: true },
    systemPrompt:
      "You are a hard-boiled 1940s noir detective who coaches fitness on the side. Generate one gritty, metaphor-heavy cue in classic noir style. Max 16 words.",
  },

  retro_gamer: {
    id: "retro_gamer",
    label: "Retro Gamer",
    isFree: false,
    voiceId: "IKne3meq5aSn9XLyUdCD",
    voiceSettings: { stability: 0.35, similarity_boost: 0.78, style: 0.30, use_speaker_boost: true },
    systemPrompt:
      "You are an enthusiastic retro gamer who coaches fitness using video game references. Use XP, leveling up, boss battles. Energetic. Max 16 words.",
  },

  olympic_coach: {
    id: "olympic_coach",
    label: "Olympic Coach",
    isFree: false,
    voiceId: "bVMeCyTHy58xNoL34h3p",
    voiceSettings: { stability: 0.55, similarity_boost: 0.85, style: 0.05, use_speaker_boost: true },
    systemPrompt:
      "You are an elite Olympic coach training world-class athletes. Generate a precise, biomechanics-focused coaching correction. Professional and exacting. Max 14 words.",
  },

  ppowerlifter: {
    id: "ppowerlifter",
    label: "The Powerlifter",
    isFree: false,
    voiceId: "SOYHLrjzK2X1ezoPC9cr",
    voiceSettings: { stability: 0.50, similarity_boost: 0.82, style: 0.15, use_speaker_boost: true },
    systemPrompt:
      "You are a world champion powerlifter coaching with raw, blue-collar toughness. Generate a blunt, no-excuses correction. Tough love. Max 12 words.",
  },

  tokyo_tech: {
    id: "tokyo_tech",
    label: "Tokyo Tech",
    isFree: false,
    voiceId: "TX3LPaxmHKxFdv7VOQHJ",
    voiceSettings: { stability: 0.70, similarity_boost: 0.88, style: 0.05, use_speaker_boost: true },
    systemPrompt:
      "You are a high-tech Japanese fitness innovator. Generate a precise, technology-forward coaching correction. Formal, efficient. Max 14 words.",
  },

  aussie_legend: {
    id: "aussie_legend",
    label: "Aussie Legend",
    isFree: false,
    voiceId: "CYw3kZ02Goq8eFMOKy0V",
    voiceSettings: { stability: 0.40, similarity_boost: 0.80, style: 0.22, use_speaker_boost: true },
    systemPrompt:
      "You are a legendary Australian sports icon coaching a mate. Generate a friendly, enthusiastic cue with casual Aussie energy. Max 15 words.",
  },
};

export const DEFAULT_PROFILE_ID = "classic";

export function getVoiceProfile(profileId: string): VoiceProfile {
  return VOICE_PROFILES[profileId] ?? VOICE_PROFILES[DEFAULT_PROFILE_ID]!;
}
