import type { ContractType } from "../types";
import { inferTenderTypeFromCategory } from "./inferTenderType";

export const CONTRACT_COMPANY_TRAVEL_PLUS = "Travel Plus";
export const CONTRACT_COMPANY_INTELLIGIC = "Intelligic";

export function inferContractCompanyName(
  category: string,
  contractType?: ContractType,
): string {
  const type = contractType ?? inferTenderTypeFromCategory(category);
  return type === "travel" ? CONTRACT_COMPANY_TRAVEL_PLUS : CONTRACT_COMPANY_INTELLIGIC;
}
