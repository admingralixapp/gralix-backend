/**
 * Biomechanical Insights Engine
 *
 * Generates contextual, data-driven "scouting report" text from a user's
 * physical measurements and target skill. All logic is pure / side-effect-free.
 */

import { type SkillNode } from "./skill-tree";

// ---------------------------------------------------------------------------
// Insight types
// ---------------------------------------------------------------------------

export interface ApeInsight {
  tag: "pulling" | "balanced" | "pushing";
  headline: string;
  detail: string;
}

export interface TorsoLegInsight {
  tag: "short-torso" | "balanced" | "long-torso";
  headline: string;
  detail: string;
}

export interface MechanicalEdge {
  /** One-line "type" label — e.g. "Long-lever puller" */
  archetype: string;
  /** Key physical fact that drives the recommendation */
  biomechFact: string;
  /** Specific training focus cue */
  recommendation: string;
  /** Colour to tint the archetype label */
  accentColor: string;
}

// ---------------------------------------------------------------------------
// Ape Index insight
// ---------------------------------------------------------------------------

export function getApeInsight(apeIndex: number): ApeInsight {
  if (apeIndex > 1.02) {
    return {
      tag: "pulling",
      headline: "Pulling Advantage",
      detail:
        "Longer reach provides better leverage for pulling skills (Front Lever, Pull-ups). " +
        "Your extended arm path generates more moment force at the bar — use it.",
    };
  }
  if (apeIndex < 0.98) {
    return {
      tag: "pushing",
      headline: "Pushing Advantage",
      detail:
        "Shorter levers reduce rotational torque, giving a mechanical advantage for pushing " +
        "skills (Planche, Handstands). Less moment arm = less force needed to lock out.",
    };
  }
  return {
    tag: "balanced",
    headline: "Balanced Proportions",
    detail:
      "Proportions close to 1.0 give you versatility across pushing and pulling disciplines. " +
      "Neither branch has a strong leverage disadvantage — consistency becomes your edge.",
  };
}

// ---------------------------------------------------------------------------
// Torso / Leg ratio insight
// ---------------------------------------------------------------------------

export function getTorsoLegInsight(
  torsoLengthCm: number,
  legLengthCm: number,
): TorsoLegInsight {
  const total = torsoLengthCm + legLengthCm;
  const torsoRatio = torsoLengthCm / total;

  if (torsoRatio < 0.44) {
    return {
      tag: "short-torso",
      headline: "Short-Torso Advantage",
      detail:
        "A shorter torso reduces the weight distal to your shoulders, making Planche holds " +
        "significantly easier to balance. Your centre of mass sits lower — a structural gift " +
        "for straight-body pressing skills.",
    };
  }
  if (torsoRatio > 0.48) {
    return {
      tag: "long-torso",
      headline: "Long-Torso Profile",
      detail:
        "A longer torso shifts more mass above the hips, increasing the moment arm in " +
        "horizontal pulling movements. Explosive hip drive and strong scapular retraction " +
        "become critical to bridge Muscle-Up and L-Sit transitions.",
    };
  }
  return {
    tag: "balanced",
    headline: "Proportional Trunk",
    detail:
      "A balanced torso-to-leg ratio means neither planche balance nor L-Sit compression " +
      "is structurally penalised. Focus on whichever skill your target demands.",
  };
}

// ---------------------------------------------------------------------------
// Mechanical Edge — full scouting report
// ---------------------------------------------------------------------------

/** Classify the target skill into a training archetype */
type SkillArchetype =
  | "planche"
  | "handstand"
  | "front-lever"
  | "muscle-up"
  | "l-sit"
  | "human-flag"
  | "pistol"
  | "pull"
  | "push"
  | "core"
  | "legs"
  | "general";

function classifyTarget(node: SkillNode): SkillArchetype {
  const id = node.id;
  if (id.startsWith("push-pp")) return "planche";
  if (id.startsWith("push-oh")) return "handstand";
  if (id.startsWith("pull-fl")) return "front-lever";
  if (id.startsWith("pull-mu")) return "muscle-up";
  if (id.startsWith("core-hh") || id === "core-2") return "l-sit";
  if (node.title.toLowerCase().includes("human flag")) return "human-flag";
  if (node.title.toLowerCase().includes("pistol")) return "pistol";
  if (node.branch === "PULL") return "pull";
  if (node.branch === "PUSH") return "push";
  if (node.branch === "CORE") return "core";
  if (node.branch === "LEGS") return "legs";
  return "general";
}

export function getMechanicalEdge(params: {
  heightCm: number | null;
  weightKg: number | null;
  apeIndex: number | null;
  torsoLengthCm: number | null;
  legLengthCm: number | null;
  targetNode: SkillNode | null;
}): MechanicalEdge {
  const { heightCm, weightKg, apeIndex, torsoLengthCm, legLengthCm, targetNode } = params;

  const arch = targetNode ? classifyTarget(targetNode) : "general";
  const skillName = targetNode?.title ?? "your target skill";

  // Derived convenience flags
  const isLongLever  = apeIndex !== null && apeIndex > 1.02;
  const isShortLever = apeIndex !== null && apeIndex < 0.98;
  const isShortTorso =
    torsoLengthCm !== null &&
    legLengthCm !== null &&
    torsoLengthCm / (torsoLengthCm + legLengthCm) < 0.44;
  const isLongTorso =
    torsoLengthCm !== null &&
    legLengthCm !== null &&
    torsoLengthCm / (torsoLengthCm + legLengthCm) > 0.48;
  const isTall   = heightCm !== null && heightCm >= 185;
  const isShort  = heightCm !== null && heightCm <= 168;
  const wingsapn = apeIndex && heightCm ? Math.round(apeIndex * heightCm) : null;

  // ── Planche ────────────────────────────────────────────────────────────────
  if (arch === "planche") {
    if (isShortTorso && isShortLever) {
      return {
        archetype: "Natural Planche Profile",
        biomechFact:
          `Short torso + short levers = the ideal mechanical blueprint for planche. Your centre of mass sits close to your hands, minimising the counterbalance moment.`,
        recommendation:
          `Exploit this advantage — progress to Tuck Planche hold durations faster than average. Focus on scapular protraction and straight-arm lock-out rather than strength.`,
        accentColor: "#22c55e",
      };
    }
    if (isLongLever || isTall) {
      const heightNote = heightCm ? `At ${Math.round(heightCm)} cm` : "With long levers";
      return {
        archetype: "Long-Lever Planche Challenge",
        biomechFact:
          `${heightNote}, each centimetre of reach increases the torque your shoulders must resist. F=ma means the longer your lever, the greater the rotational demand.`,
        recommendation:
          `Build maximum scapular strength with weighted Planche Leans and band-assisted holds. Prioritise "lean angle" progressively — every 5° forward doubles the shoulder load.`,
        accentColor: "#f97316",
      };
    }
    return {
      archetype: "Solid Planche Candidate",
      biomechFact:
        `Proportional build for the Planche path. No significant structural disadvantage — execution and consistency will be the limiting factors.`,
      recommendation:
        `Advance through the tuck→straddle→full progression methodically. Track lean angle with video review each session.`,
      accentColor: "#22c55e",
    };
  }

  // ── Handstand ──────────────────────────────────────────────────────────────
  if (arch === "handstand") {
    if (isTall && isLongLever) {
      return {
        archetype: "Long-Lever Presser",
        biomechFact:
          `${wingsapn ? `A ${wingsapn} cm wingspan` : "Long levers"} extends the moment arm between shoulder and wrist. Deltoid endurance under sustained overhead load becomes the primary limiter.`,
        recommendation:
          `Build time-under-tension with wall HSPU holds before freestanding work. Programme timed lock-out sets (5 × 30 s) alongside strength reps to develop the structural endurance you need.`,
        accentColor: "#f97316",
      };
    }
    if (isShort || isShortLever) {
      return {
        archetype: "Compact Handstand Profile",
        biomechFact:
          `Shorter stature keeps your centre of mass tighter over the base of support, reducing balance correction amplitude. Physics works in your favour here.`,
        recommendation:
          `Focus on fingertip pressure control and consistent line — your balance corrections will be smaller. Progress to freestanding HSPU faster than taller athletes.`,
        accentColor: "#22c55e",
      };
    }
    return {
      archetype: "Handstand Candidate",
      biomechFact:
        `Proportional build for overhead skills. Shoulder stability and core tension will be the primary limiters rather than lever length.`,
      recommendation:
        `Drill hollow-body wall holds (60 s minimum) before going freestanding. Build thoracic mobility alongside pressing strength.`,
      accentColor: "#22c55e",
    };
  }

  // ── Front Lever ────────────────────────────────────────────────────────────
  if (arch === "front-lever") {
    if (isLongLever) {
      return {
        archetype: "Long-Lever Puller",
        biomechFact:
          `${wingsapn ? `${wingsapn} cm wingspan` : "Extended reach"} increases the torque arm in a horizontal pull. The Front Lever demands your lats resist a force proportional to your arm length squared.`,
        recommendation:
          `Prioritise tuck → straddle → full progressions with extended hold times. Add lat-focused pulling (straight-arm pulldowns, back-lever negatives) to build the specific connective strength needed.`,
        accentColor: "#3b82f6",
      };
    }
    return {
      archetype: "Front Lever Candidate",
      biomechFact:
        isShortLever
          ? `Shorter levers reduce the moment arm in the horizontal position — you have a structural edge here. The core-to-lat link will be your primary focus.`
          : `Balanced proportions mean the Front Lever is achievable with consistent progressive training. No major structural disadvantage.`,
      recommendation:
        `Drill tuck Front Lever holds to 10+ seconds before advancing. Pair with hollow-body compression and straight-arm scapular pull work.`,
      accentColor: "#3b82f6",
    };
  }

  // ── Muscle-Up ──────────────────────────────────────────────────────────────
  if (arch === "muscle-up") {
    const heightNote = heightCm ? `At ${Math.round(heightCm)} cm` : "With your build";
    if (weightKg && weightKg > 85) {
      return {
        archetype: "Power-to-Weight Challenge",
        biomechFact:
          `${heightNote} and ${Math.round(weightKg)} kg, the Muscle-Up demands a high power-to-weight ratio in the explosive pull phase. F=ma — more mass means more force required at the transition.`,
        recommendation:
          `Focus on "Peak Velocity" during your pull-up sets — treat the last 20° before chin-over-bar as a sprint. Add kipping pull-up practice to learn the hip-momentum transfer pattern.`,
        accentColor: "#a855f7",
      };
    }
    if (isLongLever) {
      return {
        archetype: "Long-Lever Explosive Puller",
        biomechFact:
          `${wingsapn ? `${wingsapn} cm wingspan` : "Your long reach"} generates superior angular momentum on the pull, but makes the transition window narrower — you need to catch the bar with precise timing.`,
        recommendation:
          `Drill explosive pull-up negatives and chest-to-bar variations. The bar transition is the bottleneck — practice false-grip or hip-kip-to-dip combos to groove the movement.`,
        accentColor: "#22c55e",
      };
    }
    return {
      archetype: "Muscle-Up Candidate",
      biomechFact:
        `${heightNote} with balanced proportions. The Muscle-Up requires both explosive pulling power and a precise transition — neither is structurally penalised for your build.`,
      recommendation:
        `Focus on "Peak Velocity" at the top of your pull-up sets. When you can do 10+ explosive pull-ups, the Muscle-Up transition becomes a technique problem — film your attempts to analyse the bar path.`,
      accentColor: "#22c55e",
    };
  }

  // ── L-Sit / Core ──────────────────────────────────────────────────────────
  if (arch === "l-sit" || arch === "core") {
    if (isLongTorso || (legLengthCm !== null && legLengthCm > 90)) {
      return {
        archetype: "High-Inertia Core Profile",
        biomechFact:
          `Long legs increase the rotational inertia your hip flexors and core must overcome in L-Sit and hollow holds. The physics demand exceptional compression strength relative to your lever length.`,
        recommendation:
          `Progress strictly through tuck → one-leg → full L-Sit. Build hip-flexor compression with "dead bug" holds and hanging knee raises before attempting the full position.`,
        accentColor: "#a855f7",
      };
    }
    return {
      archetype: "Core Compression Candidate",
      biomechFact:
        `Proportional limb length for core skill progressions. Hip-flexor strength and lat depression will be the primary limiters rather than lever length.`,
      recommendation:
        `Drill parallel bar L-Sit holds, progressing from tuck. Pair with floor L-Sit for strength development and leg-lift negatives for hip flexor endurance.`,
      accentColor: "#22c55e",
    };
  }

  // ── Human Flag ────────────────────────────────────────────────────────────
  if (arch === "human-flag") {
    return {
      archetype: isLongTorso ? "Mass-Challenge Flag Profile" : "Flag Candidate",
      biomechFact:
        isLongTorso
          ? `A longer torso places more mass further from the vertical pole, exponentially increasing the lateral force demand on your obliques and shoulder girdle.`
          : `Proportional build for the Human Flag. Lateral strength of the obliques and shoulder girdle is the primary limiter.`,
      recommendation:
        `Build through tuck flag → straddle → full with isometric lateral holds. Add cable woodchops and side-plank variations to develop the lateral chain.`,
      accentColor: "#10b981",
    };
  }

  // ── Legs / Pistol ─────────────────────────────────────────────────────────
  if (arch === "pistol" || arch === "legs") {
    return {
      archetype: isLongTorso ? "Long-Torso Squatter" : "Compact Squatter",
      biomechFact:
        isLongTorso
          ? `A longer torso shifts your centre of mass rearward in single-leg squat patterns — ankle dorsiflexion and counterbalance control become critical.`
          : `Shorter torso keeps your centre of mass over the planted foot — a natural advantage for Pistol Squat balance.`,
      recommendation:
        isLongTorso
          ? `Work on ankle mobility and heel-elevated progressions first. Add a light counterweight in early pistol practice to calibrate balance.`
          : `Focus on eccentric control and knee tracking — your balance mechanics are structurally favourable. Progress to depth and then weighted single-leg work.`,
      accentColor: "#10b981",
    };
  }

  // ── Generic pull / push ────────────────────────────────────────────────────
  if (arch === "pull") {
    return {
      archetype: isLongLever ? "Long-Lever Puller" : "Pull Candidate",
      biomechFact:
        isLongLever
          ? `${wingsapn ? `${wingsapn} cm wingspan` : "Your reach"} generates superior bar momentum. Channel that into peak-velocity contractions on every rep.`
          : `Balanced levers make pulling skills an execution problem more than a structural one.`,
      recommendation: `Drive explosive pull-up volume — track "bar speed" as a metric alongside reps and form score.`,
      accentColor: "#3b82f6",
    };
  }

  if (arch === "push") {
    return {
      archetype: isShortLever ? "Short-Lever Pusher" : "Push Candidate",
      biomechFact:
        isShortLever
          ? `Shorter levers reduce rotational torque — your pressing mechanics are structurally efficient.`
          : `Proportional build for push skill progressions. Tricep lock-out strength will be the primary limiter.`,
      recommendation: `Build max push-up volume and dial in scapular retraction and protraction control through the full range.`,
      accentColor: "#f97316",
    };
  }

  // ── Fallback (no target or general) ───────────────────────────────────────
  if (apeIndex !== null) {
    if (isLongLever) {
      return {
        archetype: "Long-Lever Athlete",
        biomechFact:
          `${wingsapn ? `${wingsapn} cm wingspan` : "Extended reach"} is a natural asset for pulling-dominant skills. Front Lever, Muscle-Up, and Pull-Up progressions will benefit most from your proportions.`,
        recommendation: `Set a pulling-based target skill to receive a tailored daily prescription for your body type.`,
        accentColor: "#22c55e",
      };
    }
    if (isShortLever) {
      return {
        archetype: "Short-Lever Athlete",
        biomechFact:
          `Compact proportions reduce rotational torque in pressing movements. Planche and Handstand paths are your structural sweet spot.`,
        recommendation: `Set a pushing-based target skill to receive a tailored daily prescription for your body type.`,
        accentColor: "#22c55e",
      };
    }
  }

  return {
    archetype: "Balanced Athlete",
    biomechFact:
      `Proportional build with no significant structural bias toward pushing or pulling. Your training ceiling is set by consistency and programming, not anatomy.`,
    recommendation: `Set a target skill in your profile to unlock a personalised mechanical breakdown specific to your goal.`,
    accentColor: "#22c55e",
  };
}
