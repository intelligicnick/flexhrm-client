export const BULK_PAY_BANK_ACCOUNTS_KEY = "hrms_bulk_pay_bank_accounts";
const LEGACY_AXIS_DEBIT_ACCOUNT_KEY = "hrms_axis_debit_account";

export type BulkPayBankAccount = {
  id: string;
  label: string;
  accountNo: string;
  isDefault: boolean;
};

function createAccountId(): string {
  return `bpba_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeAccountNo(value: string): string {
  return value.trim();
}

function normalizeLabel(value: string): string {
  return value.trim();
}

function ensureSingleDefault(accounts: BulkPayBankAccount[]): BulkPayBankAccount[] {
  if (accounts.length === 0) return accounts;
  const defaultIndex = accounts.findIndex((a) => a.isDefault);
  if (defaultIndex >= 0) {
    return accounts.map((account, index) => ({
      ...account,
      isDefault: index === defaultIndex,
    }));
  }
  return accounts.map((account, index) => ({
    ...account,
    isDefault: index === 0,
  }));
}

function migrateLegacyDebitAccount(): BulkPayBankAccount[] {
  if (typeof window === "undefined") return [];
  const legacy = localStorage.getItem(LEGACY_AXIS_DEBIT_ACCOUNT_KEY);
  const accountNo = normalizeAccountNo(legacy || "");
  if (!accountNo) return [];

  return [
    {
      id: createAccountId(),
      label: "Primary Debit Account",
      accountNo,
      isDefault: true,
    },
  ];
}

export function loadBulkPayBankAccounts(): BulkPayBankAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(BULK_PAY_BANK_ACCOUNTS_KEY);
    if (!saved) {
      const migrated = migrateLegacyDebitAccount();
      if (migrated.length > 0) {
        saveBulkPayBankAccounts(migrated);
        localStorage.removeItem(LEGACY_AXIS_DEBIT_ACCOUNT_KEY);
      }
      return migrated;
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    const accounts = parsed
      .map((item) => {
        const accountNo = normalizeAccountNo(String(item?.accountNo || ""));
        const label = normalizeLabel(String(item?.label || ""));
        if (!accountNo) return null;
        return {
          id: String(item?.id || createAccountId()),
          label: label || "Bank Account",
          accountNo,
          isDefault: Boolean(item?.isDefault),
        } satisfies BulkPayBankAccount;
      })
      .filter((item): item is BulkPayBankAccount => item !== null);

    return ensureSingleDefault(accounts);
  } catch {
    return [];
  }
}

export function saveBulkPayBankAccounts(accounts: BulkPayBankAccount[]): void {
  const normalized = ensureSingleDefault(
    accounts.map((account) => ({
      ...account,
      label: normalizeLabel(account.label) || "Bank Account",
      accountNo: normalizeAccountNo(account.accountNo),
    })).filter((account) => account.accountNo)
  );
  localStorage.setItem(BULK_PAY_BANK_ACCOUNTS_KEY, JSON.stringify(normalized));
}

export function getDefaultBulkPayDebitAccountNo(): string | null {
  const accounts = loadBulkPayBankAccounts();
  const defaultAccount = accounts.find((account) => account.isDefault) || accounts[0];
  return defaultAccount?.accountNo || null;
}

export function getDefaultBulkPayBankAccount(): BulkPayBankAccount | null {
  const accounts = loadBulkPayBankAccounts();
  return accounts.find((account) => account.isDefault) || accounts[0] || null;
}

export function addBulkPayBankAccount(label: string, accountNo: string): BulkPayBankAccount[] {
  const trimmedLabel = normalizeLabel(label);
  const trimmedAccountNo = normalizeAccountNo(accountNo);
  if (!trimmedAccountNo) return loadBulkPayBankAccounts();

  const accounts = loadBulkPayBankAccounts();
  const duplicate = accounts.some((account) => account.accountNo === trimmedAccountNo);
  if (duplicate) return accounts;

  const next: BulkPayBankAccount = {
    id: createAccountId(),
    label: trimmedLabel || "Bank Account",
    accountNo: trimmedAccountNo,
    isDefault: accounts.length === 0,
  };

  const updated = ensureSingleDefault([...accounts, next]);
  saveBulkPayBankAccounts(updated);
  return updated;
}

export function updateBulkPayBankAccount(
  id: string,
  updates: { label?: string; accountNo?: string },
): BulkPayBankAccount[] {
  const accounts = loadBulkPayBankAccounts();
  const index = accounts.findIndex((account) => account.id === id);
  if (index < 0) return accounts;

  const nextAccountNo = updates.accountNo !== undefined
    ? normalizeAccountNo(updates.accountNo)
    : accounts[index].accountNo;
  const nextLabel = updates.label !== undefined
    ? normalizeLabel(updates.label) || "Bank Account"
    : accounts[index].label;

  if (!nextAccountNo) return accounts;

  const duplicate = accounts.some(
    (account, accountIndex) => accountIndex !== index && account.accountNo === nextAccountNo,
  );
  if (duplicate) return accounts;

  const updated = accounts.map((account, accountIndex) =>
    accountIndex === index
      ? { ...account, label: nextLabel, accountNo: nextAccountNo }
      : account,
  );
  saveBulkPayBankAccounts(updated);
  return updated;
}

export function deleteBulkPayBankAccounts(ids: string[]): BulkPayBankAccount[] {
  const idSet = new Set(ids);
  const updated = loadBulkPayBankAccounts().filter((account) => !idSet.has(account.id));
  saveBulkPayBankAccounts(updated);
  return loadBulkPayBankAccounts();
}

export function setDefaultBulkPayBankAccount(id: string): BulkPayBankAccount[] {
  const accounts = loadBulkPayBankAccounts();
  if (!accounts.some((account) => account.id === id)) return accounts;

  const updated = accounts.map((account) => ({
    ...account,
    isDefault: account.id === id,
  }));
  saveBulkPayBankAccounts(updated);
  return updated;
}

export function validateBulkPayBankAccountInput(label: string, accountNo: string): string | null {
  const trimmedAccountNo = normalizeAccountNo(accountNo);
  if (!trimmedAccountNo) return "Account number is required.";
  if (!/^\d{6,18}$/.test(trimmedAccountNo)) {
    return "Enter a valid account number (6–18 digits).";
  }
  if (normalizeLabel(label).length > 80) {
    return "Account label must be 80 characters or fewer.";
  }
  return null;
}
