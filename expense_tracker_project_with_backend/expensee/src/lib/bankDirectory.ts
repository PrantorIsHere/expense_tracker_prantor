import banksData from '@/data/banks.json';
import logoManifest from '@/data/bank-logos.json';

/**
 * Banks and mobile wallets operating in Bangladesh, with their logos.
 * Edit src/data/banks.json to add or rename one, then run
 * `node scripts/fetch-bank-logos.mjs` to download its logo.
 */
export interface Bank {
  id: string;
  name: string;
  short: string;
  aliases: string[];
  category: string;
  type: 'bank' | 'mobile_wallet';
  domain?: string;
  logo?: string;
}

type RawBank = Omit<Bank, 'aliases' | 'logo' | 'type'> & { aliases?: string[]; logo?: string; type: string };
const manifest = logoManifest as Record<string, string>;

export const BANKS: Bank[] = (banksData as RawBank[]).map(b => ({
  ...b,
  type: b.type === 'mobile_wallet' ? 'mobile_wallet' : 'bank',
  aliases: b.aliases ?? [],
  logo: b.logo ?? manifest[b.id],
}));

export const BANK_CATEGORIES = ['Private', 'Islamic', 'State-owned', 'Specialised', 'Foreign', 'Mobile financial service'];

const normalize = (value: string) => value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
const strip = (value: string) => normalize(value).replace(/\b(plc|limited|ltd|the)\b/g, ' ').replace(/\s+/g, ' ').trim();

// Every name a bank goes by, longest first, so "mutual trust bank" wins over "trust bank".
const NAME_INDEX = BANKS.flatMap(bank =>
  [bank.name, bank.short, ...bank.aliases]
    .map(strip)
    .filter(term => term.length >= 3)
    .map(term => ({ term, bank })),
).sort((a, b) => b.term.length - a.term.length);

export const findBankById = (id: string | null | undefined) => (id ? BANKS.find(b => b.id === id) : undefined);

/** Exact match on a saved bank name (what the picker stores on the account). */
export const findBankByName = (name: string | null | undefined) => {
  if (!name) return undefined;
  const key = strip(name);
  return BANKS.find(b => strip(b.name) === key || strip(b.short) === key || b.aliases.some(a => strip(a) === key));
};

/** The bank an account belongs to: its saved bank name first, then the longest bank name found in the account name. */
export function matchBank(accountName?: string | null, bankName?: string | null): Bank | undefined {
  const saved = findBankByName(bankName);
  if (saved) return saved;
  if (!accountName) return undefined;
  const haystack = ` ${strip(accountName)} `;
  return NAME_INDEX.find(({ term }) => haystack.includes(` ${term} `))?.bank;
}

/** Case-insensitive search over names, short names and aliases. */
export function searchBanks(query: string): Bank[] {
  const q = normalize(query);
  if (!q) return BANKS;
  return BANKS.filter(b => [b.name, b.short, ...b.aliases].some(n => normalize(n).includes(q)));
}
