import { SCHOOL_MATERIAL_ITEMS } from "../types";
import { SupervisorTranslationKey } from "./supervisor-i18n";

const MATERIAL_LABEL_KEYS: Record<(typeof SCHOOL_MATERIAL_ITEMS)[number], SupervisorTranslationKey> = {
  Phenyl: "materialPhenyl",
  Brush: "materialBrush",
  Jhaadu: "materialJhaadu",
  Harpic: "materialHarpic",
  Broom: "materialBroom",
  Mop: "materialMop",
};

export function getMaterialLabel(
  item: (typeof SCHOOL_MATERIAL_ITEMS)[number],
  t: (key: SupervisorTranslationKey) => string,
): string {
  return t(MATERIAL_LABEL_KEYS[item]);
}
