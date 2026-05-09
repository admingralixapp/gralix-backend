/**
 * t-exercise — translates a stored exercise name (English DB value) into the
 * current UI language by looking it up in the `exercises.*` namespace.
 *
 * Keys are derived by lower-casing the English name and replacing all
 * non-alphanumeric characters with underscores, then trimming edge underscores.
 *
 * Usage:
 *   import { tExercise } from "@/lib/t-exercise";
 *   const { t } = useTranslation();
 *   <h3>{tExercise(session.exerciseName, t)}</h3>
 */

import { type TFunction } from "i18next";

export function toExerciseKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function tExercise(name: string, t: TFunction): string {
  const key = `exercises.${toExerciseKey(name)}`;
  const result = t(key, { defaultValue: "__MISSING__" });
  return result === "__MISSING__" ? name : result;
}

export function tMuscle(name: string, t: TFunction): string {
  const key = `muscles.${toExerciseKey(name)}`;
  const result = t(key, { defaultValue: "__MISSING__" });
  return result === "__MISSING__" ? name : result;
}
