import { SCHOOL_MATERIAL_ITEMS } from "../types";
import { SupervisorTranslationKey } from "./supervisor-i18n";

const MATERIAL_LABEL_KEYS: Record<(typeof SCHOOL_MATERIAL_ITEMS)[number], SupervisorTranslationKey> = {
  Phenyl: "materialPhenyl",
  Brush: "materialBrush",
  Jhaadu: "materialJhaadu",
  Harpic: "materialHarpic",
  Handwash: "materialHandwash",
  Mop: "materialMop",
};

const LEGACY_MATERIAL_LABEL_KEYS: Record<string, SupervisorTranslationKey> = {
  Broom: "materialHandwash",
};

export function getMaterialLabel(
  item: string,
  t: (key: SupervisorTranslationKey) => string,
): string {
  const key =
    MATERIAL_LABEL_KEYS[item as (typeof SCHOOL_MATERIAL_ITEMS)[number]] ||
    LEGACY_MATERIAL_LABEL_KEYS[item];
  return key ? t(key) : item;
}
