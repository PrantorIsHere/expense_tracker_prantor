import { matchBank } from './bankDirectory';

/**
 * Logo for an account, from the bank directory (src/data/banks.json + bank-logos.json).
 * Logos are the trademarks of their banks, shown only to identify the user's accounts.
 */
export interface BankLogo {
  name: string;
  src: string;
}

/** Pass the account name and, when known, the saved bank name. */
export function bankLogoFor(accountName?: string | null, bankName?: string | null): BankLogo | undefined {
  const bank = matchBank(accountName, bankName);
  return bank?.logo ? { name: bank.name, src: bank.logo } : undefined;
}
