import type { LookupItem, LookupKind } from '@news/shared/schemas';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useLookupItems, useLookupSearch } from '@/hooks/use-lookup';
import { notify } from '@/lib/notify';

interface LookupMultiSelectProps {
  kind: LookupKind;
  value: number[];
  onChange: (ids: number[]) => void;
  label: string;
  disabled?: boolean;
  /** Show photos/logos (persons, organizations). */
  withImages?: boolean;
  /** When set, a missing entry can be created from the search text (tags, editors/admins only). */
  onCreate?: (name: string) => Promise<LookupItem>;
  /** Most items that can be linked (the API accepts 50). */
  max?: number;
}

function ItemAvatar({ item }: { item: LookupItem }) {
  return (
    <Avatar className="size-6">
      {item.imageUrl && <AvatarImage src={item.imageUrl} alt="" />}
      <AvatarFallback className="text-xs">{Array.from(item.label.replace(/^.\./, ''))[0] ?? '?'}</AvatarFallback>
    </Avatar>
  );
}

/** Chips for the selected items plus a searchable popover backed by /v1/admin/lookup/<kind>. */
export function LookupMultiSelect({ kind, value, onChange, label, disabled, withImages, onCreate, max = 50 }: LookupMultiSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  // Items picked in this session, so a chip shows its label before hydration catches up.
  const [picked, setPicked] = useState<Map<number, LookupItem>>(new Map());
  const hydrated = useLookupItems(kind, value);
  const debounced = useDebouncedValue(search.trim(), 300);
  const results = useLookupSearch(kind, debounced, open);

  const itemFor = (id: number): LookupItem => picked.get(id) ?? hydrated.get(id) ?? { id, label: `#${id}`, sublabel: null, imageUrl: null };
  const remember = (item: LookupItem) => setPicked((prev) => new Map(prev).set(item.id, item));

  function toggle(item: LookupItem) {
    if (value.includes(item.id)) {
      onChange(value.filter((id) => id !== item.id));
    } else if (value.length < max) {
      remember(item);
      onChange([...value, item.id]);
    }
  }

  const items = results.data?.data ?? [];
  const query = search.trim();
  const canCreate = onCreate && query !== '' && !items.some((item) => item.label.toLowerCase() === query.toLowerCase());

  async function create() {
    if (!onCreate || creating) return;
    setCreating(true);
    try {
      const item = await onCreate(query);
      remember(item);
      if (!value.includes(item.id)) onChange([...value, item.id]);
      setSearch('');
    } catch (err) {
      notify.apiError(err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={label}>
          {value.map((id) => {
            const item = itemFor(id);
            return (
              <li key={id} className="flex items-center gap-1.5 rounded-full border bg-muted/50 py-0.5 pr-1 pl-1.5 text-sm">
                {withImages && <ItemAvatar item={item} />}
                <span>{item.label}</span>
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-full"
                    aria-label={t('lookup.remove', { name: item.label })}
                    onClick={() => onChange(value.filter((other) => other !== id))}
                  >
                    <X aria-hidden />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between font-normal" disabled={disabled} aria-label={t('lookup.add', { label })}>
            <span className="text-muted-foreground">{t('lookup.add', { label })}</span>
            <ChevronsUpDown className="opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
          {/* Server-side search: cmdk's own filtering is off. */}
          <Command shouldFilter={false}>
            <CommandInput value={search} onValueChange={setSearch} placeholder={t('lookup.search')} aria-label={t('lookup.search')} />
            <CommandList>
              {!results.isFetching && items.length === 0 && !canCreate && <CommandEmpty>{t('lookup.empty')}</CommandEmpty>}
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem key={item.id} value={String(item.id)} onSelect={() => toggle(item)}>
                    {withImages && <ItemAvatar item={item} />}
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{item.label}</span>
                      {item.sublabel && <span className="truncate text-xs text-muted-foreground">{item.sublabel}</span>}
                    </div>
                    {value.includes(item.id) && <Check className="ml-auto" aria-hidden />}
                  </CommandItem>
                ))}
                {canCreate && (
                  <CommandItem value="__create" onSelect={create} disabled={creating}>
                    <Plus aria-hidden />
                    {t('lookup.create', { name: query })}
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
