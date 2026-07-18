import { loadSave, updateSave, type SaveData } from "../../data/save";

export type TutorialStepId =
  | "select_enemy"
  | "swap_gems"
  | "color_heroes"
  | "enemy_countdown"
  | "match_four"
  | "ability_ready"
  | "visit_village";

export const TUTORIAL_ORDER: TutorialStepId[] = [
  "select_enemy",
  "swap_gems",
  "color_heroes",
  "enemy_countdown",
  "match_four",
  "ability_ready",
  "visit_village",
];

/** First three battle steps are shown as one banner on Ruins. */
export const CORE_LOOP_STEPS: TutorialStepId[] = [
  "select_enemy",
  "swap_gems",
  "color_heroes",
];

export const CORE_LOOP_COPY = "Tap enemy. Match 3+ — colors hit.";

export const TUTORIAL_COPY: Record<TutorialStepId, string> = {
  select_enemy: CORE_LOOP_COPY,
  swap_gems: CORE_LOOP_COPY,
  color_heroes: CORE_LOOP_COPY,
  enemy_countdown: "Numbers drop. At 0 they strike.",
  match_four: "Armor blocks. Match 4 = Extra Move.",
  ability_ready: "Glow = ability. Tap the hero.",
  visit_village: "Village: spend gold before the boss.",
};

export function isCoreLoopStep(step: TutorialStepId): boolean {
  return CORE_LOOP_STEPS.includes(step);
}

export function tutorialCandidatesForEncounter(
  encounterId: string,
): TutorialStepId[] {
  switch (encounterId) {
    case "ruins":
      return [...CORE_LOOP_STEPS];
    case "forest":
      return ["enemy_countdown"];
    case "quarry":
      return ["match_four"];
    case "cave":
    case "fortress":
    default:
      return ["ability_ready"];
  }
}

export function isTutorialStepDone(
  save: SaveData,
  step: TutorialStepId,
): boolean {
  return Boolean(save.tutorialSteps?.[step]);
}

export function markTutorialStep(step: TutorialStepId): SaveData {
  if (isCoreLoopStep(step)) return markCoreLoopSteps();
  const save = loadSave();
  const tutorialSteps = { ...save.tutorialSteps, [step]: true };
  const allDone = TUTORIAL_ORDER.every((s) => tutorialSteps[s]);
  return updateSave({
    tutorialSteps,
    tutorialCompleted: allDone || save.tutorialCompleted,
  });
}

export function markCoreLoopSteps(): SaveData {
  const save = loadSave();
  const tutorialSteps = { ...save.tutorialSteps };
  for (const step of CORE_LOOP_STEPS) {
    tutorialSteps[step] = true;
  }
  const allDone = TUTORIAL_ORDER.every((s) => tutorialSteps[s]);
  return updateSave({
    tutorialSteps,
    tutorialCompleted: allDone || save.tutorialCompleted,
  });
}

export function skipAllTutorials(): SaveData {
  const tutorialSteps = Object.fromEntries(
    TUTORIAL_ORDER.map((s) => [s, true]),
  ) as Record<TutorialStepId, boolean>;
  return updateSave({ tutorialSteps, tutorialCompleted: true });
}

export function resetTutorial(): SaveData {
  return updateSave({
    tutorialSteps: {},
    tutorialCompleted: false,
  });
}

export function nextPendingStep(
  save: SaveData,
  candidates: TutorialStepId[],
): TutorialStepId | null {
  if (save.tutorialCompleted) return null;
  for (const step of candidates) {
    if (!isTutorialStepDone(save, step)) return step;
  }
  return null;
}
