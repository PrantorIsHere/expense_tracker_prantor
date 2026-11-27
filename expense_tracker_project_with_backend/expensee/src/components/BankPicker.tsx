import { useState } from 'react';
import { Check, ChevronsUpDown, Search, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AccountAvatar } from '@/components/erp';
import { BANKS, BANK_CATEGORIES, type Bank, findBankById } from '@/lib/bankDirectory';
import { cn } from '@/lib/utils';

export type BankChoice = { kind: 'bank'; bank: Bank } | { kind: 'cash' } | { kind: 'other'; name: string };

interface BankPickerProps {
  id?: string;
  /** Selected bank id, 'cash', or '' for none / other. */
  value: string;
  onChange: (choice: BankChoice) => void;
  className?: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  Private: 'Private banks',
  Islamic: 'Islamic banks',
  'State-owned': 'State-owned banks',
  Specialised: 'Specialised banks',
  Foreign: 'Foreign banks',
  'Mobile financial service': 'Mobile wallets',
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Plain substring search over the item's name and keywords (no fuzzy letter matching). */
const matches = (value: string, search: string, keywords?: string[]) => {
  const q = normalize(search);
  if (!q) return 1;
  return [value, ...(keywords ?? [])].some(text => normalize(text).includes(q)) ? 1 : 0;
};

/** Searchable list of every bank and wallet in the directory, with logos. */
export default function BankPicker({ id, value, onChange, className }: BankPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = findBankById(value);

  const choose = (choice: BankChoice) => {
    onChange(choice);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open}
          className={cn('h-10 w-full justify-start gap-2 px-3 font-normal', className)}>
          {selected ? (
            <>
              <AccountAvatar name={selected.short} bankName={selected.name} size="xs" />
              <span className="truncate">{selected.name}</span>
            </>
          ) : value === 'cash' ? (
            <>
              <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span>Cash in hand</span>
            </>
          ) : (
            <>
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">Search {BANKS.length} banks and wallets</span>
            </>
          )}
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[20rem] p-0">
        <Command filter={matches}>
          <CommandInput autoFocus placeholder="Bank or wallet name" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-80">
            <CommandEmpty className="p-2">
              <button type="button" onClick={() => choose({ kind: 'other', name: query.trim() })}
                className="w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-accent">
                Not listed. Use “{query.trim()}” as the account name
              </button>
            </CommandEmpty>
            <CommandGroup heading="Cash">
              <CommandItem value="cash" keywords={['Cash in hand']} onSelect={() => choose({ kind: 'cash' })} className="gap-2.5">
                <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
                Cash in hand
                {value === 'cash' && <Check className="ml-auto h-4 w-4" aria-hidden />}
              </CommandItem>
            </CommandGroup>
            {BANK_CATEGORIES.map(category => {
              const list = BANKS.filter(b => b.category === category);
              if (!list.length) return null;
              return (
                <CommandGroup key={category} heading={CATEGORY_LABEL[category] ?? category}>
                  {list.map(bank => (
                    <CommandItem
                      key={bank.id}
                      value={bank.id}
                      keywords={[bank.name, bank.short, ...bank.aliases]}
                      onSelect={() => choose({ kind: 'bank', bank })}
                      className="gap-2.5"
                    >
                      <AccountAvatar name={bank.short} bankName={bank.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{bank.short}</span>
                        {bank.short !== bank.name && <span className="block truncate text-xs text-muted-foreground">{bank.name}</span>}
                      </span>
                      {value === bank.id && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
            {query.trim() && (
              <CommandGroup heading="Other">
                <CommandItem value="__other__" keywords={[query]} onSelect={() => choose({ kind: 'other', name: query.trim() })} className="gap-2.5">
                  Use “{query.trim()}” as the account name
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
