import type { Contract } from "../types";

function locationKey(value: string): string {
  return value.trim().toLowerCase();
}

export function contractIncludesLocation(contract: Contract, location: string): boolean {
  const key = locationKey(location);
  if (!key) return false;
  return (contract.linkedLocations || []).some((loc) => locationKey(loc) === key);
}

export function findContractsForLocation(
  location: string,
  contracts: Contract[],
): Contract[] {
  const key = locationKey(location);
  if (!key) return [];
  return contracts.filter((contract) => contractIncludesLocation(contract, location));
}

export function resolveContractIdForLocation(
  location: string,
  contracts: Contract[],
): string {
  const matches = findContractsForLocation(location, contracts);
  return matches.length === 1 ? matches[0].id : "";
}

export function formatContractLabel(contract: Contract): string {
  const parts = [contract.contractNo];
  if (contract.companyName?.trim()) parts.push(contract.companyName.trim());
  if (contract.officeName?.trim()) parts.push(contract.officeName.trim());
  return parts.join(" · ");
}

export function otherContractsUsingLocation(
  location: string,
  contracts: Contract[],
  excludeContractId?: string,
): Contract[] {
  return findContractsForLocation(location, contracts).filter(
    (contract) => contract.id !== excludeContractId,
  );
}
