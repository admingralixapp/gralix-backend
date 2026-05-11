/**
 * Form Cue Library — Tier 1 of the three-tier cue architecture.
 *
 * Provides 5–8 instructional variants per form-fault condition so the
 * coach never repeats the same phrase twice in a row.
 *
 * Design principles:
 *  - Every variant is a complete, actionable biomechanical instruction.
 *  - Exercise-specific pools override generic pools for named exercises.
 *  - Pure TypeScript — no DOM APIs, safe to import inside Web Workers.
 *
 * Usage:
 *   import { pickFormCue } from "./form-cues";
 *   audioCue = pickFormCue("Push-Up", "elbows_flaring");
 */

// ─── Anti-repetition tracker ──────────────────────────────────────────────────
// Key: `${exerciseName}:${conditionKey}` → index of the last-used variant.
const _lastIdx = new Map<string, number>();

function pickVariant(key: string, pool: readonly string[]): string {
  if (pool.length === 1) return pool[0]!;
  const last = _lastIdx.get(key) ?? -1;
  let idx: number;
  let attempts = 0;
  do {
    idx = Math.floor(Math.random() * pool.length);
    attempts++;
  } while (idx === last && attempts < 10);
  _lastIdx.set(key, idx);
  return pool[idx]!;
}

// ─── Generic condition pools ──────────────────────────────────────────────────
// Covers every exercise that doesn't have a specific override below.

const GENERIC: Record<string, readonly string[]> = {

  elbows_flaring: [
    "Tuck your elbows — they should point back, not out.",
    "Elbows in — keep them tracking close to your body.",
    "Pin those elbows — 45 degrees from your torso.",
    "Less flare — drive your elbows backward, not sideways.",
    "Elbows are opening wide — rotate hands out slightly and tuck.",
    "Keep elbows tight — imagine squeezing your sides.",
    "Elbows flaring — think 'elbows to pockets'.",
  ],

  hips_sagging: [
    "Hips are sinking — squeeze your glutes and brace your core.",
    "Lift the hips — posterior pelvic tilt to level the spine.",
    "Don't sag — tighten everything from ribs to pelvis.",
    "Core losing tension — pull the navel in and brace.",
    "Rigid body — hips in line with shoulders and heels.",
    "Drive the hips up — squeeze the glutes harder.",
    "Lower back is giving out — re-brace and hold it.",
  ],

  hips_too_high: [
    "Hips piking up — lower them into a straight line.",
    "Drop the hips — body should be flat, not a V.",
    "Flatten the back — bring those hips level.",
    "Too much pike — push hips toward the floor.",
    "Hips above the shoulder line — lower them down.",
    "Squeeze the glutes — that brings the hips into position.",
  ],

  not_deep_enough: [
    "Go deeper — get the full range of motion.",
    "More depth — don't cut the rep short.",
    "Full range — all the way down.",
    "Half rep, half the benefit — push through to depth.",
    "Fight through the sticking point — go deeper.",
    "Partial reps, partial results — earn the full range.",
    "Don't stop short — the hardest point is at the bottom.",
  ],

  swinging: [
    "Control the swing — use strength, not momentum.",
    "Stop the kipping — dead body, then pull clean.",
    "Eliminate the swing — brace your core first.",
    "Still the body — pure strength, no cheating.",
    "No momentum — reset and pull strict.",
    "Hollow body first, then initiate the pull.",
    "The swing is robbing the muscle — stop it.",
  ],

  chin_not_over_bar: [
    "Higher — get your chin over the bar.",
    "Drive up — chin needs to clear the bar completely.",
    "Pull harder — chin above the bar to count the rep.",
    "All the way up — don't stop below the bar.",
    "Chin over bar — give that last ten percent.",
  ],

  heels_rising: [
    "Push through your heels — don't let them float.",
    "Heels down — sit back, not forward.",
    "Ground those heels — push them into the floor.",
    "Heels coming up — sit back further to fix it.",
    "Weight in your heels — that's where the drive comes from.",
    "Heels rising — drive them down, not up.",
  ],

  chest_dropping: [
    "Chest up — don't let your torso fall forward.",
    "Tall spine — look straight ahead, not at the floor.",
    "Keep your chest proud — don't fold at the waist.",
    "Upright torso — brace and sit tall throughout.",
    "Don't pitch forward — your power follows your chest.",
    "Proud chest — drive it up for the whole movement.",
  ],

  knees_caving: [
    "Knees out — push them in line with your toes.",
    "Drive the knees out — don't let them collapse inward.",
    "Spread the floor with your feet — knees follow.",
    "Knees tracking toes — external rotation from the hip.",
    "Fight the cave — push your knees apart.",
    "Valgus collapse — engage the hip abductors and push out.",
  ],

  no_full_extension: [
    "Lock it out — full extension at the top.",
    "All the way up — don't stop short.",
    "Complete the rep — extend fully.",
    "Squeeze at the top — full lockout.",
    "Finish the movement — extend all the way.",
    "Don't park halfway — push to full lockout.",
  ],

  core_loose: [
    "Brace your core — squeeze everything.",
    "Tighten up — core, glutes, everything on.",
    "Hold the tension — stay braced throughout.",
    "Don't relax the core — keep it engaged.",
    "Core loosening — breathe out and re-brace.",
    "Rigid body — tension from head to toe.",
    "Posterior pelvic tilt — flatten that lower back.",
  ],

  arms_bent: [
    "Lock your arms straight — elbows fully extended.",
    "Straighten the arms — fully extend.",
    "Arms should be locked — push to full extension.",
    "Soft elbows — straighten them all the way out.",
    "Arms need to be fully locked — no bent elbows.",
  ],

  no_rigid_body: [
    "Rigid body — no breaking at the hips.",
    "Stay straight — move as one rigid piece.",
    "Don't fold — keep the body in one long line.",
    "Like a plank — locked from head to heels.",
    "Hip break detected — squeeze everything to straighten.",
    "One rigid line — resist the bend.",
  ],

  body_not_horizontal: [
    "Body needs to be horizontal — fight gravity.",
    "Drive the hips level — don't let them drop.",
    "Hold it horizontal — squeeze everything.",
    "Get that body parallel to the ground.",
    "Horizontal or nothing — pull that position.",
  ],

  no_shoulder_depression: [
    "Depress the scapula — pull your shoulders away from your ears.",
    "Active shoulders — press them down, not passive.",
    "Engage the shoulder blades — pull them down and back.",
    "Pack your shoulders — depress them actively.",
    "Shoulders creeping up — pull them down.",
  ],

  free_leg_down: [
    "Extend your free leg — keep it forward and off the ground.",
    "Hold that free leg up — it carries the balance.",
    "Free leg is dropping — pull it back up.",
    "Don't let the free leg rest — keep it elevated.",
    "Free leg parallel to the floor — hold it there.",
  ],

  chest_to_bar_cue: [
    "Drive your chest to the bar — pull higher.",
    "More height — chest needs to meet the bar.",
    "Pull until your chest touches — you're almost there.",
    "Higher pull — don't stop at the chin.",
    "Chest to bar — that's the full rep.",
  ],

  no_lean_forward: [
    "Lean forward — shoulders over your wrists.",
    "More lean — that's where the planche comes from.",
    "Drive the shoulders forward — over the hands.",
    "Lean in — it has to feel uncomfortable.",
    "Push the lean — that angle builds the skill.",
  ],

  stack_over_wrists: [
    "Stack your hips over your wrists — tighten your core.",
    "Align the body — hips directly above the wrists.",
    "Everything over the wrists — squeeze and stack.",
    "Hips drifting — bring them back over the wrists.",
    "Straight line from wrists to heels — achieve it.",
  ],

  one_arm_bent: [
    "Lock out that extended arm — keep it straight as a rod.",
    "The extended arm is bending — lock it out.",
    "Straight arm, full tension — don't let it collapse.",
    "Keep the assisting arm locked — that's your stability.",
    "Extended arm going soft — lock the elbow.",
  ],

  dont_pike: [
    "Don't pike — stay rigid from head to toe.",
    "No hip break — one straight line throughout.",
    "Hips folding through — brace and resist.",
    "Like a plank in the air — no bending.",
    "Rigid body — resist the pike at all costs.",
  ],

  hips_down: [
    "Keep your hips up — don't let them sag.",
    "Drive the hips up — squeeze those glutes.",
    "Hips are falling — fight to keep them level.",
    "Don't let gravity win — hold those hips up.",
    "Hip drop — engage the obliques and lift.",
  ],

  dont_rock: [
    "Don't rock your hips — brace your lower back.",
    "Hips steady — the movement is only in the limbs.",
    "Stabilize the pelvis — don't let it tilt.",
    "Lower back pressed to floor — keep it there.",
    "Hips are rocking — slow down and control it.",
  ],

  lift_symmetrically: [
    "Lift chest and legs together — squeeze your glutes.",
    "Simultaneous — both ends up at the same time.",
    "Upper and lower together — like a bow.",
    "Symmetrical lift — don't favor one end.",
    "Chest and legs rise together — hold the squeeze.",
  ],

  legs_straight: [
    "Keep your legs straight — no bending at the knee.",
    "Lock the knees — legs fully extended.",
    "Straight legs — the movement is from the hip, not the knee.",
    "Knees are bending — extend them fully.",
    "Rigid legs — straight as poles throughout.",
  ],

  tuck_knees: [
    "Tuck your knees tight to your chest.",
    "Drive the knees in — full tuck position.",
    "Knees aren't tucked — pull them in tighter.",
    "Compress harder — knees toward the chest.",
    "Full tuck — knees up and in.",
  ],

  balance: [
    "Stay balanced — keep your hip over your ankle.",
    "Control the balance — don't let the hip drift.",
    "Hip alignment — stack it over the working foot.",
    "Wobbling — slow down and control the movement.",
    "Balance first — steady the base, then move.",
  ],

  control_descent: [
    "Slow the descent — control every inch.",
    "Eccentric control — don't fall through the bottom.",
    "Slow and steady — this is where strength is built.",
    "Control it down — the lowering phase counts.",
    "Fight the descent — resist all the way.",
  ],

  sit_tall: [
    "Sit tall — don't collapse your spine.",
    "Upright spine — don't round through the back.",
    "Tall torso — keep your chest proud.",
    "Spine neutral — don't hinge at the waist.",
    "Drive the chest up — sit tall throughout.",
  ],

  legs_horizontal: [
    "Drive your legs parallel — compress harder.",
    "Legs horizontal — push them up to floor level.",
    "Legs drooping — squeeze your hip flexors.",
    "Parallel to the floor — fight for that angle.",
    "Compress the hip angle — legs need to be level.",
  ],

  squeeze_abs: [
    "Squeeze abs and glutes — don't arch.",
    "No arch — flatten the spine with your core.",
    "Abs tight — resist the arching.",
    "Brace against the arch — pull the ribs down.",
    "Hollow position — abs and glutes together.",
  ],

  dead_hang_required: [
    "Full dead hang — lock out your elbows at the bottom.",
    "Extend fully — reach the dead hang before pulling.",
    "Arms fully straight at the bottom — don't cut the eccentric.",
    "Dead hang — that's where the lat stretch is.",
    "Full extension at the bottom — then pull.",
  ],

  pull_evenly: [
    "Pull evenly — engage your lats on both sides.",
    "Both sides pulling equally — check the symmetry.",
    "Don't favor one side — even pull through the back.",
    "Balanced pull — feel both lats engage.",
    "Symmetrical effort — both lats, not just one.",
  ],

  press_evenly: [
    "Press evenly on both sides.",
    "Both arms equal — don't let one side dominate.",
    "Symmetrical press — bilateral control.",
    "Equal pressure — feel both sides working.",
    "Keep the press balanced — both hands pushing equally.",
  ],
};

// ─── Exercise-specific pools ──────────────────────────────────────────────────
// Override or extend generic pools with exercise-specific coaching language.

const SPECIFIC: Record<string, Record<string, readonly string[]>> = {

  "Push-Up": {
    elbows_flaring: [
      "Elbows at 45 degrees — think arrow, not cross.",
      "Tuck those elbows — they should graze your ribs on the way down.",
      "Stop the flare — elbows tracking back, not wide.",
      "Rotate hands slightly outward and tuck the elbows in.",
      "Elbows flaring — think 'elbows to pockets'.",
      "Close the gap — elbows back, not out to the sides.",
    ],
    hips_sagging: [
      "Hips dropping — posterior pelvic tilt, flatten the lower back.",
      "Rigid body from head to heels — squeeze the glutes.",
      "The push-up is a moving plank — stay rigid.",
      "Core tight — don't let the hips sink toward the floor.",
      "Squeeze the glutes — that lifts the hips back into line.",
      "Posterior pelvic tilt — tuck the pelvis and flatten.",
    ],
    hips_too_high: [
      "Drop those hips — straight line from head to heels.",
      "Too much pike — lower the hips into the plank.",
      "Hips above shoulder line — bring them down.",
      "Flatten the position — hips level with the body.",
      "That's a pike push-up — lower the hips for a standard one.",
    ],
    no_rigid_body: [
      "Straight line — head to heels throughout.",
      "Rigid plank — don't break at the hips.",
      "Body is bending — brace and straighten.",
      "Like a wooden board — no give anywhere.",
      "Head to heels — one straight line.",
    ],
  },

  "Diamond Push-Up": {
    elbows_flaring: [
      "Diamond grip means elbows track straight back — not out.",
      "Keep elbows along your sides — that's the tricep load.",
      "Squeeze the triceps — elbows back, not splaying.",
      "Tuck harder — diamond grip demands tight elbows.",
      "Elbows tucking in — that's the whole point of this variation.",
    ],
    core_loose: [
      "Rigid plank — don't let the hips sag.",
      "Core tight — diamond is already demanding enough.",
      "Brace hard — hold the plank while you push.",
      "Squeeze everything — this position demands total tension.",
      "Stay rigid — core on at all times.",
    ],
  },

  "Incline Push-Up": {
    hips_too_high: [
      "Keep your hips down — straight line from head to heels.",
      "Drop those hips — this isn't a pike position.",
      "Flat body — hips in line with shoulders and heels.",
      "Lower the hips — rigid plank throughout.",
    ],
    hips_sagging: [
      "Hips dropping — tighten your core.",
      "Squeeze the glutes — stop the sag.",
      "Hold the plank — don't let the hips fall.",
      "Rigid incline plank — no sagging allowed.",
    ],
  },

  "Knee Push-Up": {
    hips_too_high: [
      "Lower your hips — keep a straight line from shoulder to knee.",
      "Too much pike — bring the hips level.",
      "Hips down — shoulder to knee should be straight.",
      "Drop the hips — straight line to the knees.",
    ],
    hips_sagging: [
      "Hips sagging — squeeze your glutes.",
      "Core on — don't let the hips sag.",
      "Straight line from shoulder to knee — brace and hold.",
      "Squeeze the glutes — that fixes the sag.",
    ],
  },

  "Pike Push-Up": {
    hips_too_high: [
      "Hips even higher — the steeper the V, the more shoulder load.",
      "Keep the inverted V sharp — don't flatten it.",
      "Push hips up and back — that's the position.",
      "Tall hips — this is a shoulder press, not a push-up.",
    ],
    not_deep_enough: [
      "Head needs to almost touch the floor — lower.",
      "All the way down — nose toward the ground.",
      "More depth — feel the shoulder stretch at the bottom.",
      "Don't stop halfway — get the head down.",
    ],
  },

  "Elevated Pike Push-Up": {
    hips_too_high: [
      "Hips must stay elevated — elevated feet demand it.",
      "Keep that steep angle — feet up means hips higher.",
      "Don't let the hips drop — this variation needs a sharp angle.",
      "Hips high — that's what loads the shoulders harder.",
    ],
    not_deep_enough: [
      "Head toward the floor — get the full range.",
      "Lower than a standard pike — elevated feet demand more depth.",
      "Full depth — forehead nearly touches.",
      "More range — the elevation gives you more to work with.",
    ],
  },

  "Dip": {
    elbows_flaring: [
      "Elbows track straight back — parallel, not splaying.",
      "Don't let the elbows spread — shoulder injury risk.",
      "Tuck the elbows — they should point behind you.",
      "Elbows parallel — that's the dip, not the butterfly.",
    ],
    not_deep_enough: [
      "Dip deeper — upper arm needs to reach parallel.",
      "Full depth — 90 degrees at the elbow minimum.",
      "Go lower — feel the chest stretch at the bottom.",
      "Don't stop early — break parallel with the upper arm.",
    ],
    no_full_extension: [
      "Lock out at the top — push to full extension.",
      "Finish the dip — straighten those arms completely.",
      "All the way up — full lockout counts the rep.",
      "Don't park halfway — push through to extension.",
    ],
  },

  "Pull-Up": {
    chin_not_over_bar: [
      "Higher — chin needs to clear the bar.",
      "Drive the chest toward the bar — don't stop at chin level.",
      "Pull until your chin is fully over — that's the rep.",
      "More height — give it that last inch.",
      "Chin over bar — dig deep for that final pull.",
    ],
    swinging: [
      "Stop the swing — hollow body, then pull.",
      "Eliminate kipping — this is a strict pull-up.",
      "Dead stop, then pull clean — no momentum.",
      "Control the body — hollow hold first.",
      "Strict pull only — every swing cheats the lat.",
    ],
    dead_hang_required: [
      "Full dead hang at the bottom — lock out the elbows.",
      "Extend fully — reach the dead hang before you pull again.",
      "Arms fully straight at the bottom — earn every rep.",
      "Dead hang — that's where the lat stretch lives.",
    ],
  },

  "Chin-Up": {
    chin_not_over_bar: [
      "Chin over the bar — all the way up.",
      "Pull to full height — chin clears the bar.",
      "Supinated grip gives you the bicep — use it to get over.",
      "More height — chin past the bar to count.",
    ],
    swinging: [
      "Strict chin-up — no kip.",
      "Dead body — pull clean with no swing.",
      "Hollow body and pull straight up — no momentum.",
      "Control it — the swing is cheating the bicep.",
    ],
  },

  "Muscle-Up": {
    no_full_extension: [
      "Press all the way to lockout — full extension at the top.",
      "Drive through — don't stop before the arms are straight.",
      "Full lockout — that's what makes the rep complete.",
      "Arms fully straight at the top — finish it.",
    ],
    swinging: [
      "Less swing — use your lats to initiate.",
      "Control the kip — a deliberate swing, not chaotic.",
      "The kip should be intentional — then pull explosively.",
      "Minimize swing — the lats do the work.",
    ],
  },

  "Explosive Pull-Up": {
    swinging: [
      "Pull from the lats — less swing, more power.",
      "Explosive pull, not explosive swing — lats first.",
      "Control the approach — then drive hard.",
      "Less body swing — the power comes from the back.",
      "Minimal kip — your lats should be doing the work.",
    ],
  },

  "Scapular Shrugs": {
    arms_bent: [
      "Keep arms completely straight — only move the shoulder blades.",
      "Lock the elbows — all movement is scapular only.",
      "Straight arms are non-negotiable here — isolate the scapula.",
      "Arms bending — straighten and refocus on the shoulder blades.",
      "Elbow lockout first — then move the shoulder blades.",
    ],
  },

  "Australian Rows": {
    hips_sagging: [
      "Rigid body — hips in line with shoulders and heels.",
      "Squeeze the glutes — don't let the hips sag.",
      "Straight plank — from head to heels.",
      "The row is a moving plank — stay rigid.",
      "Hips dropping — brace the core and lift them.",
    ],
  },

  "Negative Pull-Ups": {
    swinging: [
      "Control the descent — no swinging.",
      "Dead stop, then lower slowly — no momentum.",
      "Eliminate the swing — pure eccentric control.",
      "No swinging — slow resistance all the way down.",
      "The negative is the whole rep — control every inch.",
    ],
  },

  "Chest-to-Bar Pull-Up": {
    chest_to_bar_cue: [
      "Drive your chest to the bar — pull higher.",
      "More height — chest needs to meet the bar.",
      "Pull until your chest touches — you're almost there.",
      "Higher pull — don't stop at the chin.",
      "Chest to bar — that's the full rep.",
    ],
    swinging: [
      "Control the swing — pull straight up.",
      "Less kip — explosive pull, not body swing.",
      "Minimize the swing — pull from the back.",
      "Controlled approach — then drive the chest to the bar.",
    ],
    dead_hang_required: [
      "Full dead hang — lock out your elbows.",
      "Arms fully straight at the bottom.",
      "Dead hang before every rep — earn it.",
      "Full extension at the bottom — then explode.",
    ],
  },

  "Archer Pull-Up": {
    one_arm_bent: [
      "Keep the extended arm locked out — straight as a rod.",
      "Extended arm bending — straighten it fully.",
      "The extended arm must be rigid — lock the elbow.",
      "Straight extended arm — full tension throughout.",
    ],
    swinging: [
      "Shift your weight fully onto the working arm.",
      "Less momentum — weight onto the working side.",
      "Transfer the load to the working arm — not the swing.",
      "Working arm takes the weight — not the body swing.",
    ],
    no_full_extension: [
      "Pull your elbow to your hip on the working side.",
      "Drive the working elbow down — full pull.",
      "Elbow to hip — complete the range on the working arm.",
      "Full pull on the working side — elbow to the hip.",
    ],
  },

  "Handstand Push-Up": {
    stack_over_wrists: [
      "Stack your hips over your wrists — tighten your core.",
      "Align everything over the hands — no banana arch.",
      "Hips drifting — bring them back over the wrists.",
      "Hollow body overhead — hips tight, no arch.",
    ],
  },

  "Handstand": {
    stack_over_wrists: [
      "Stack your hips directly over your wrists — straight line.",
      "Hips drifting — realign over the hands.",
      "Everything stacked — wrists, shoulders, hips, ankles.",
      "One straight vertical line — align it.",
    ],
    no_shoulder_depression: [
      "Push the floor away — engage your shoulders actively.",
      "Active shoulders — press down, don't hang passively.",
      "Pack those shoulders — depress and press.",
      "Shoulder engagement — push the floor away.",
    ],
  },

  "Plank": {
    hips_sagging: [
      "Hips sinking — posterior pelvic tilt, flatten the back.",
      "Squeeze glutes — they're the anchor of the plank.",
      "Drive the hips level — don't sag.",
      "Like a steel rod — straight from head to heels.",
      "Core alone isn't enough — add the glutes and lift.",
    ],
    hips_too_high: [
      "Hips piking up — lower them to neutral.",
      "Body should be flat — not a tent shape.",
      "Drop those hips — plank, not downward dog.",
      "Too much pike — push the hips toward the floor.",
    ],
    core_loose: [
      "Breathe through it — exhale long, stay braced.",
      "Posterior pelvic tilt — flatten that lower back.",
      "Squeeze glutes — they hold the plank together.",
      "Brace hard — imagine bracing for impact.",
      "Re-brace — breathe in, hold, squeeze everything.",
    ],
  },

  "Side Plank": {
    hips_down: [
      "Lift those hips — body straight from head to feet.",
      "Drive the hip up — don't let gravity win.",
      "Hip sinking — obliques on, lift it.",
      "Off the ground — hip must stay elevated.",
      "Push through the supporting hand — lift the hip.",
    ],
    dont_pike: [
      "Don't pike — keep a rigid straight line.",
      "Body straight — no folding at the hips.",
      "Rigid side plank — resist the bend.",
      "Straight line — don't break at the hips.",
    ],
  },

  "Squat": {
    not_deep_enough: [
      "Sink lower — hips below the knees is the standard.",
      "Break parallel — get full depth.",
      "More depth — drive those hips down.",
      "Below parallel — squat, don't quarter-squat.",
      "Deeper — hip crease below knee level.",
      "Fight through the sticking point at parallel.",
    ],
    heels_rising: [
      "Heels stay down — sit back, not forward.",
      "Weight in your heels — stop the rise.",
      "Ground those heels — push them into the floor.",
      "Heels floating — open the hips and sit back.",
      "Ankle mobility limiting you — widen the stance slightly.",
    ],
    chest_dropping: [
      "Chest up — don't fold forward.",
      "Tall spine — look straight ahead.",
      "Proud chest — maintain it throughout the squat.",
      "Don't pitch forward — brace the core and sit tall.",
      "Head up, chest up — the whole way down.",
    ],
    knees_caving: [
      "Drive the knees out — spread the floor.",
      "Knees over toes — push them apart.",
      "External rotation — fight the valgus.",
      "Knees out — think about spreading the floor with your feet.",
      "Spread the floor — knees track over the little toe.",
    ],
    core_loose: [
      "Keep your chest up and spine neutral.",
      "Brace the core — stay rigid throughout.",
      "Neutral spine — brace and squat.",
      "Core tight — protect the lower back.",
    ],
  },

  "Pistol Squat": {
    not_deep_enough: [
      "Full depth — hamstring to calf at the bottom.",
      "All the way down — pistol requires full range.",
      "Deeper — don't stop before full squat depth.",
      "Sit into the pistol — go all the way.",
    ],
    free_leg_down: [
      "Free leg forward and elevated — that's the pistol.",
      "Hold that leg up — letting it drop is cheating.",
      "Free leg parallel or higher — control it.",
      "Keep it extended — free leg up, not resting.",
    ],
  },

  "Archer Squat": {
    one_arm_bent: [
      "Straighten the extended leg — lock that knee out.",
      "Extended leg bending — push it straight.",
      "Lock out the extended leg — full tension.",
      "Straight extended leg throughout — no bending.",
    ],
    not_deep_enough: [
      "Sink lower into the working leg.",
      "More depth on the working side — get into it.",
      "Drive deeper — the working knee should travel far.",
      "Lower — the working leg needs full flexion.",
    ],
  },

  "Assisted Squat": {
    chest_dropping: [
      "Chest up — use your support and sit back.",
      "Tall torso — your support is there to help you go deep.",
      "Proud chest — use the support to sit tall.",
      "Chest up — let the support handle the balance.",
    ],
  },

  "Assisted Pistol Squat": {
    free_leg_down: [
      "Extend your free leg forward — keep it off the ground.",
      "Free leg up — this is a pistol, not a lunge.",
      "Hold the free leg extended — that's the test.",
      "Lift the free leg — keep it elevated throughout.",
    ],
  },

  "Close-Stance Squat": {
    not_deep_enough: [
      "Go deeper — full depth required for this variation.",
      "Full squat — break all the way through.",
      "More depth — close stance demands good flexibility.",
      "Deeper — push your ankle mobility.",
    ],
    core_loose: [
      "Bring your feet together — that's the close stance.",
      "Feet need to be closer — close-stance means narrow.",
      "Narrow the stance — heels nearly together.",
      "Feet together — that's the whole point of this variation.",
    ],
    chest_dropping: [
      "Chest up — sit back into it.",
      "Tall spine — close stance is harder, but stay upright.",
      "Proud chest — don't fold.",
      "Sit tall — upright torso throughout.",
    ],
  },

  "Bulgarian Split Squat": {
    knees_caving: [
      "Front knee over the toes — don't let it cave inward.",
      "Drive the knee out — tracking over the foot.",
      "Knee drift — push it back over the toes.",
      "Knee alignment — it should track the second toe.",
    ],
    chest_dropping: [
      "Torso upright — sink straight down.",
      "Chest up — don't lean over the front knee.",
      "Tall spine — the depth comes from the hip, not the lean.",
      "Upright torso throughout — hinge only at the hip.",
    ],
  },

  "Shrimp Squat": {
    not_deep_enough: [
      "Go deeper — full depth shrimp squat.",
      "More depth — rear knee to the floor.",
      "All the way down — that's the full shrimp.",
      "Deeper — touch the rear knee down.",
    ],
    balance: [
      "Stay balanced — keep your hip over your ankle.",
      "Hip alignment — stack it over the working foot.",
      "Control the wobble — slow down and stabilize.",
      "Steady the base — balance first, then go deeper.",
    ],
    control_descent: [
      "Control the descent — slow and steady.",
      "Slow it down — fight every inch of the way.",
      "Eccentric control — don't fall through the bottom.",
      "Slow and deliberate — this is where the strength is built.",
    ],
  },

  "Lunge": {
    chest_dropping: [
      "Torso upright — don't lean into the lunge.",
      "Chest up — vertical torso throughout the lunge.",
      "Don't hinge at the waist — stay tall.",
      "Proud chest — upright throughout the movement.",
    ],
    knees_caving: [
      "Front knee tracks over the toes — don't let it cave.",
      "Drive the front knee out — in line with the foot.",
      "Knee tracking — over the middle of the foot.",
      "Valgus on the front knee — push it out.",
    ],
  },

  "Nordic Curls": {
    no_rigid_body: [
      "Rigid body from knees to shoulders — no break at the hips.",
      "Stay straight — lower as one rigid piece.",
      "Don't fold at the hips — plank from knee to shoulder.",
      "Hip break kills the Nordic — stay rigid.",
      "One piece — from the knee through the shoulder.",
    ],
  },

  "Burpee": {
    no_full_extension: [
      "Explode up — full extension at the top.",
      "Jump tall — reach full extension overhead.",
      "Drive through — stand fully upright at the top.",
      "Full extension — arms overhead, legs straight.",
    ],
  },

  "Archer Push-Up": {
    one_arm_bent: [
      "Lock out the extended arm — straight as a rod.",
      "The extended arm is losing tension — straighten it.",
      "Straight extended arm — that's what makes it an archer.",
      "Keep the assisting arm locked — don't let it bend.",
    ],
    no_rigid_body: [
      "Stay rigid — lower with full body control.",
      "Rigid body — no sagging as you lower.",
      "Plank throughout — even with the wide arm position.",
      "Stay straight — control the descent.",
    ],
  },

  "Pseudo Planche Push-Up": {
    no_lean_forward: [
      "Lean forward — shoulders over your rotated hands.",
      "More lean — that's what loads the anterior deltoids.",
      "Drive the shoulders forward — over the hands.",
      "Lean is everything here — push it forward.",
    ],
  },

  "Planche Lean": {
    no_rigid_body: [
      "Rigid plank — no hip pike or sag.",
      "Body straight — lean without breaking.",
      "Maintain the plank while you lean.",
      "No bend — rigid from head to heels.",
    ],
    no_lean_forward: [
      "Lean forward — shoulders over your wrists.",
      "More lean — that's the whole point.",
      "Push the lean — get the shoulders forward.",
      "Lean in — shoulders ahead of the wrists.",
    ],
  },

  "Tuck Planche": {
    arms_bent: [
      "Lock your elbows — push the floor away.",
      "Elbows locked — fully extend before you hold.",
      "Straight arms are the foundation — lock them.",
      "No bent elbows in planche — fully extend.",
    ],
    no_lean_forward: [
      "Lean forward further — pull your hips off the floor.",
      "More lean — hips won't lift without the forward shift.",
      "Drive the shoulders forward — that's what lifts the hips.",
      "Lean in — the lean creates the lift.",
    ],
  },

  "Straddle Planche": {
    arms_bent: [
      "Elbows locked — push the floor away with maximum force.",
      "Full lockout — bent elbows break the planche.",
      "Straight arms — the entire skill depends on it.",
      "Lock out fully — no softness in the elbows.",
    ],
    body_not_horizontal: [
      "Lean more forward — hips need to come level.",
      "Drive the hips up — body horizontal.",
      "More forward lean to bring the hips level.",
      "Hips need to match shoulder height.",
    ],
  },

  "Planche": {
    arms_bent: [
      "Lock out elbows — maximum push.",
      "Full extension — bent elbows break the planche.",
      "Arms completely straight — push the floor away.",
      "Lock it out — every degree of bend matters here.",
    ],
    body_not_horizontal: [
      "Body must be perfectly horizontal — squeeze everything.",
      "Drive the hips level — fight gravity.",
      "Horizontal — that's the only position that counts.",
      "Squeeze everything — hips, abs, glutes — hold it level.",
    ],
  },

  "Tuck Front Lever": {
    arms_bent: [
      "Lock your elbows out — arms fully straight.",
      "Elbows must be extended — that's the lever position.",
      "Straight arms — bent elbows break the front lever.",
      "Lock out fully — arms are the base of this skill.",
    ],
    body_not_horizontal: [
      "Lift your hips — body should be horizontal.",
      "Lower your hips — match them to shoulder height.",
      "Drive the hips level — fight for horizontal.",
      "Body horizontal — hips in line with shoulders.",
    ],
  },

  "Straddle Front Lever": {
    arms_bent: [
      "Extend your arms fully — elbows locked.",
      "Full lockout — no soft elbows in the lever.",
      "Arms straight — that's non-negotiable.",
      "Lock those elbows — fully extended throughout.",
    ],
    body_not_horizontal: [
      "Raise the hips — fight to keep them level.",
      "Drop the hips — match shoulder height.",
      "Drive the hips horizontal — squeeze everything.",
      "Level the body — hips to shoulder height.",
    ],
  },

  "Full Front Lever": {
    arms_bent: [
      "Fully lock out your elbows.",
      "Arms completely straight — zero bend allowed.",
      "Lock out fully — the full lever demands it.",
      "Elbow lockout — that's the foundation.",
    ],
    body_not_horizontal: [
      "Body must be perfectly horizontal — squeeze everything.",
      "Fight for horizontal — squeeze abs and lats.",
      "Level the body — squeeze from fingertips to toes.",
      "Horizontal or nothing — hold that position.",
    ],
  },

  "Dragon Flag": {
    dont_pike: [
      "Don't pike — keep a rigid straight line from shoulder to ankle.",
      "No folding — body straight throughout.",
      "Resist the pike — brace everything.",
      "Rigid from shoulder to toe — no bend at the hips.",
    ],
    squeeze_abs: [
      "Don't arch — squeeze abs and glutes.",
      "No arch — flatten the spine with your core.",
      "Abs tight — resist arching.",
      "Hollow position — abs and glutes together.",
    ],
    body_not_horizontal: [
      "Hold it horizontal — fight gravity.",
      "Body level — squeeze everything to maintain the angle.",
      "Horizontal hold — don't let it drop.",
      "Fight the fall — keep the body level.",
    ],
  },

  "Dragon Flag Negative": {
    dont_pike: [
      "Don't pike — rigid straight line from shoulder to feet.",
      "No hip break — resist the fold.",
      "Stay rigid — like a plank descending, not a fold.",
      "Brace everything — hips must not break.",
      "One rigid piece — no folding at any point.",
    ],
  },

  "Human Flag": {
    arms_bent: [
      "Lock out both arms — push and pull with max tension.",
      "Both arms fully extended — that's the flag position.",
      "Arms straight — bent elbows collapse the flag.",
      "Lock the arms — push with the top, pull with the bottom.",
    ],
    body_not_horizontal: [
      "Drive the hips up — body should be level.",
      "Push and pull — keep the body horizontal.",
      "Fight the hip drop — engage everything.",
      "Hips dropping — drive them back up to level.",
    ],
    no_rigid_body: [
      "Squeeze your core — body straight as a board.",
      "Rigid body — no folding at the hips.",
      "Straight line from head to feet.",
      "Core and glutes — hold the straight body.",
    ],
  },

  "Tucked Human Flag": {
    arms_bent: [
      "Lock out both arms — push and pull with max tension.",
      "Both arms extended — the tuck doesn't help if the arms bend.",
      "Arms straight — push and pull to full extension.",
      "Lock both elbows — that's your structural foundation.",
    ],
    body_not_horizontal: [
      "Drive the hips up — body should be level.",
      "Body horizontal — push and pull to achieve it.",
      "Level the hips — they should match the shoulder height.",
      "Hips up — fight for that horizontal position.",
    ],
  },

  "Hollow Body Hold": {
    free_leg_down: [
      "Raise your legs — keep them straight and together.",
      "Legs up — the lower the legs, the harder the hollow.",
      "Keep the legs elevated — that's the position.",
      "Legs dropping — pull them back up.",
    ],
    no_rigid_body: [
      "Curl your shoulders off the floor — reach arms forward.",
      "Shoulders off the floor — curl the upper back.",
      "Upper body up — shoulders need to be elevated.",
      "Reach forward with the arms — shoulders up.",
    ],
    core_loose: [
      "Keep your body long and horizontal — squeeze your core.",
      "Long hollow — press the lower back to the floor.",
      "Squeeze the core — lower back to the floor.",
      "Tight hollow — abs contracted, lower back pressed down.",
    ],
  },

  "Tuck L-Sit": {
    arms_bent: [
      "Lock out your arms — press down through your palms.",
      "Elbows fully extended — push the surface away.",
      "Straight arms are the base — lock them.",
      "Arms need to be locked — press down hard.",
    ],
    no_shoulder_depression: [
      "Push the floor away — lift your hips off the surface.",
      "Press down harder — hips need to come up.",
      "Drive through the palms — get the hips airborne.",
      "Push the surface away — hips off the floor.",
    ],
    tuck_knees: [
      "Tuck your knees tight to your chest.",
      "Drive the knees in — full tuck position.",
      "Knees aren't tucked — pull them in tighter.",
      "Compress harder — knees toward the chest.",
    ],
  },

  "L-Sit": {
    arms_bent: [
      "Lock your elbows — press the surface away.",
      "Fully extended arms — push down hard.",
      "Straight arms are the foundation — lock them.",
      "Soft elbows break the L-Sit — straighten fully.",
    ],
    no_shoulder_depression: [
      "Push harder — lift your hips off the surface.",
      "Drive through the palms — get airborne.",
      "More press — hips need to clear the surface.",
      "Press the surface away with everything you've got.",
    ],
    legs_horizontal: [
      "Drive your legs parallel — compress harder.",
      "Legs horizontal — push them up to floor level.",
      "Legs drooping — squeeze your hip flexors.",
      "Parallel to the floor — fight for that angle.",
    ],
  },

  "L-Sit Compression": {
    sit_tall: [
      "Sit tall — don't collapse your spine.",
      "Upright spine — don't round through the back.",
      "Tall torso — keep your chest proud.",
      "Spine neutral — stay upright throughout.",
    ],
  },

  "Active Hang": {
    arms_bent: [
      "Lock your elbows — straight arms.",
      "Fully extended — no bend at the elbow.",
      "Elbow lockout — that's the active hang.",
      "Arms straight — bent elbows is the passive hang.",
    ],
    no_shoulder_depression: [
      "Depress your scapula — pull shoulders away from your ears.",
      "Active shoulders — pull them down from the ears.",
      "Scapular depression — that's what makes it active.",
      "Shoulders away from the ears — actively depress.",
    ],
  },

  "Hanging Knee Tuck": {
    swinging: [
      "Control the swing — use your core to tuck.",
      "No swinging — tuck from the hips, not momentum.",
      "Still the body — core-driven tuck only.",
      "Minimize swing — controlled movement from the hips.",
    ],
  },

  "Hanging Leg Raise": {
    legs_straight: [
      "Keep your legs straight — this is a leg raise, not a knee raise.",
      "Lock the knees — raise with straight legs.",
      "Bent knees make it easier — straighten them.",
      "Legs fully extended — that's the target.",
    ],
    swinging: [
      "No swinging — slow and controlled.",
      "Stop the momentum — use your core to raise.",
      "Dead body — controlled raise, controlled lower.",
      "Eliminate the swing — this is all core.",
    ],
  },

  "Toes to Bar": {
    swinging: [
      "Control the swing — less kip.",
      "Minimal kip — drive from the core.",
      "Controlled swing — then explosive fold.",
      "Less body swing — core does the work.",
    ],
  },

  "Windshield Wiper": {
    hips_down: [
      "Keep your hips up — don't let them drop.",
      "Hips must stay elevated — drive them level.",
      "Hip drop — engage the core and lift.",
      "Hips falling — brace harder and hold them up.",
    ],
  },

  "Dead Bug": {
    dont_rock: [
      "Don't rock your hips — brace your lower back.",
      "Hips steady — the movement is only in the limbs.",
      "Stabilize the pelvis — don't let it tilt.",
      "Lower back pressed to floor — keep it there.",
      "Hips rocking — slow down and stabilize.",
    ],
  },

  "Superman": {
    lift_symmetrically: [
      "Lift chest and legs together — squeeze your glutes.",
      "Simultaneous — both ends up at the same time.",
      "Upper and lower together — like a bow.",
      "Chest and legs rise together — hold the squeeze.",
    ],
  },

  "Ring Pull-Up": {
    pull_evenly: [
      "Pull evenly on both rings.",
      "Both sides equal — check the symmetry.",
      "Symmetrical pull — both lats engaged.",
      "Even effort — don't let one side dominate.",
    ],
    swinging: [
      "Control the swing — strict reps.",
      "No swinging — rings demand more control, not less.",
      "Still the body — strict ring pull-up.",
      "Minimize swing — clean strict rep.",
    ],
  },

  "Ring Dip": {
    press_evenly: [
      "Press evenly on both rings.",
      "Both arms equal — don't let one side dominate.",
      "Symmetrical press — bilateral ring control.",
      "Equal pressure — feel both sides working.",
    ],
    elbows_flaring: [
      "Control the descent — elbows back.",
      "Elbows tracking back — not splaying on the rings.",
      "Tuck the elbows — rings make this harder.",
      "Elbows point behind you — control the descent.",
    ],
  },

  "Ring Support Hold": {
    arms_bent: [
      "Lock your elbows — straight arms.",
      "Fully extended — rings demand locked elbows.",
      "Elbow lockout — that's the support position.",
      "Arms fully straight — push down on the rings.",
    ],
    no_shoulder_depression: [
      "Push down on the rings — lift your body up.",
      "Drive through the rings — hips need to be above.",
      "Press the rings down — elevate your body.",
      "Push into the rings — get your hips above them.",
    ],
  },

  "Ring Muscle-Up": {
    no_full_extension: [
      "Drive through the transition — press to lockout.",
      "Full extension at the top — rings need locked elbows.",
      "Press out completely — arms straight at the top.",
      "Lockout at the top — finish the rep.",
    ],
  },

  "Weighted Pull-Up": {
    swinging: [
      "Stop swinging — strict pull, straight up.",
      "Extra weight means no swing — pull clean.",
      "Eliminate the swing — the weight amplifies it.",
      "Strict weighted pull — no kipping with load.",
    ],
  },

  "Weighted Muscle-Up": {
    no_full_extension: [
      "Full lockout — press to the top under load.",
      "Arms fully straight at the top — even with the weight.",
      "Complete the press — full extension under load.",
      "Lock out — the weight makes it harder, but you need the lockout.",
    ],
  },

  "Weighted Dip": {
    elbows_flaring: [
      "Control the descent — elbows tucked under load.",
      "Extra weight means more shoulder risk — tuck those elbows.",
      "Elbows back — weight makes flaring dangerous.",
      "Tuck the elbows — controlled weighted dip.",
    ],
  },

  "Typewriter Pull-Up": {
    swinging: [
      "No swinging — shift laterally with arms, not hips.",
      "Lateral shift is upper body only — not momentum.",
      "Still the hips — the shift comes from the arms.",
      "Arms do the lateral work — not body swing.",
    ],
  },

  "Pike Stretch": {
    legs_straight: [
      "Straighten your knees — don't bend them to reach.",
      "Locked knees — the stretch comes from hamstring length.",
      "No bending to reach — earn the depth with straight legs.",
      "Knees straight — that's what stretches the hamstrings.",
    ],
    not_deep_enough: [
      "Fold deeper — reach your chest toward your legs.",
      "More range — exhale and sink deeper.",
      "Deeper fold — let the hamstrings lengthen.",
      "Sink into it — relaxed exhale and fold.",
    ],
  },

  "Step-Up": {
    knees_caving: [
      "Drive your knee out — track over your toes.",
      "Knee caving — push it outward over the foot.",
      "Knee alignment — track over the second toe.",
      "External rotation — drive the knee out.",
    ],
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a varied, non-repeating instructional cue for the given exercise
 * and form-fault condition.
 *
 * Prefers exercise-specific cue pools; falls back to the generic pool for
 * the condition. Returns the condition key as a last-resort fallback.
 */
export function pickFormCue(exerciseName: string, conditionKey: string): string {
  const key  = `${exerciseName}:${conditionKey}`;
  const pool = SPECIFIC[exerciseName]?.[conditionKey] ?? GENERIC[conditionKey];
  if (!pool?.length) return conditionKey;
  return pickVariant(key, pool);
}
