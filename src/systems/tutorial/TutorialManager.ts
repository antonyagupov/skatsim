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

export const TUTORIAL_COPY: Record<TutorialStepId, string> = {
  select_enemy: "Tap an enemy to select your target.",
  swap_gems: "Swap adjacent gems to make a match of 3+.",
  color_heroes: "Each gem color activates one hero.",
  enemy_countdown: "Enemy numbers count down — at 0 they attack!",
  match_four: "Match 4 gems for an Extra Move.",
  ability_ready: "When a hero glows, tap them to use their ability.",
  visit_village: "Spend gold and materials in the Village.",
};

export function isTutorialStepDone(
  save: SaveData,
  step: TutorialStepId,
): boolean {
  return Boolean(save.tutorialSteps?.[step]);
}

export function markTutorialStep(step: TutorialStepId): SaveData {
  const save = loadSave();
  const tutorialSteps = { ...save.tutorialSteps, [step]: true };
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
