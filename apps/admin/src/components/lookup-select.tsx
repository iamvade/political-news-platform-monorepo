import type { LookupItem, LookupKind } from '@news/shared/schemas';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useLookupItems, useLookupSearch } from '@/hooks/use-lookup';

interface LookupSelectProps {
  id?: string;
  kind: LookupKind;
  value: number | null;
  onChange: (id: number | null, item: LookupItem | null) => void;
  /** Accessible name of the trigger, e.g. "Байгууллага". */
  label: string;
  disabled?: boolean;
  withImages?: boolean;
  clearable?: boolean;
  invalid?: boolean;
}

function ItemAvatar({ item }: { item: LookupItem }) {
  return (
    <Avatar className="size-6">
      {item.imageUrl && <AvatarImage src={item.imageUrl} alt="" />}
      <AvatarFallback className="text-xs">{Array.from(item.label.replace(/^.\./, ''))[0] ?? '?'}</AvatarFallback>
    </Avatar>
  );
}

/** One entity from /v1/admin/lookup/<kind>: a button showing the choice, a searchable popover to change it. */
export function LookupSelect({ id, kind, value, onChange, label, disabled, withImages, clearable, invalid }: LookupSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<LookupItem | null>(null);
  const hydrated = useLookupItems(kind, value === null ? [] : [value]);
  const debounced = useDebouncedValue(search.trim(), 300);
  const results = useLookupSearch(kind, debounced, open);
  const current = value === null ? null : picked?.id === value ? picked : (hydrated.get(value) ?? { id: value, label: `#${value}`, sublabel: null, imageUrl: null });
  const items = results.data?.data ?? [];

  return (
    <div className="flex gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className="min-w-0 flex-1 justify-between font-normal"
            disabled={disabled}
            aria-label={current ? `${label}: ${current.label}` : label}
            aria-invalid={invalid}
          >
            <span className="flex min-w-0 items-center gap-2">
              {current && withImages && <ItemAvatar item={current} />}
              <span className={current ? 'truncate' : 'truncate text-muted-foreground'}>{current?.label ?? t('lookup.choose')}</span>
            </span>
            <ChevronsUpDown className="opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput value={search} onValueChange={setSearch} placeholder={t('lookup.search')} aria-label={t('lookup.search')} />
            <CommandList>
              {!results.isFetching && items.length === 0 && <CommandEmpty>{t('lookup.empty')}</CommandEmpty>}
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={String(item.id)}
                    onSelect={() => {
                      setPicked(item);
                      onChange(item.id, item);
                      setOpen(false);
                    }}
                  >
                    {withImages && <ItemAvatar item={item} />}
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{item.label}</span>
                      {item.sublabel && <span className="truncate text-xs text-muted-foreground">{item.sublabel}</span>}
                    </div>
                    {item.id === value && <Check className="ml-auto" aria-hidden />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {clearable && value !== null && !disabled && (
        <Button type="button" variant="ghost" size="icon" aria-label={t('lookup.clear', { label })} onClick={() => onChange(null, null)}>
          <X aria-hidden />
        </Button>
      )}
    </div>
  );
}
