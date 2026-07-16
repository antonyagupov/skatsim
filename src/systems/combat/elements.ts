import type { GemId } from "../../assets/types";

/** Four-color elemental cycle used by combat damage modifiers. */
export type ElementId = "red" | "blue" | "green" | "yellow";

export const ELEMENT_IDS: ElementId[] = ["red", "blue", "green", "yellow"];

export const GEM_TO_ELEMENT: Record<GemId, ElementId> = {
  "gem-flame": "red",
  "gem-ice": "blue",
  "gem-leaf": "green",
  "gem-light": "yellow",
};

/** Strong against map: attacker → defender that takes ×1.5. */
const STRONG_AGAINST: Record<ElementId, ElementId> = {
  red: "green",
  green: "yellow",
  yellow: "blue",
  blue: "red",
};

export type AffinityResult = {
  modifier: number;
  tag: "WEAK" | "RESIST" | "NEUTRAL";
};

export function elementalModifier(
  attackElement: ElementId,
  defenseElement: ElementId,
): AffinityResult {
  if (STRONG_AGAINST[attackElement] === defenseElement) {
    return { modifier: 1.5, tag: "WEAK" };
  }
  if (STRONG_AGAINST[defenseElement] === attackElement) {
    return { modifier: 0.75, tag: "RESIST" };
  }
  return { modifier: 1, tag: "NEUTRAL" };
}

export function elementForGem(gem: GemId): ElementId {
  return GEM_TO_ELEMENT[gem];
}

export function elementLabel(el: ElementId): string {
  switch (el) {
    case "red":
      return "Flame";
    case "blue":
      return "Ice";
    case "green":
      return "Leaf";
    case "yellow":
      return "Light";
  }
}

export function elementColor(el: ElementId): number {
  switch (el) {
    case "red":
      return 0xd04a2e;
    case "blue":
      return 0x3a8ad0;
    case "green":
      return 0x4a9c5a;
    case "yellow":
      return 0xe0c040;
  }
}
