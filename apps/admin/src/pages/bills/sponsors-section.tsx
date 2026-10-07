import { SPONSOR_ROLES, type AdminBill, type SponsorRole } from '@news/shared/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { Save, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LookupSelect } from '@/components/lookup-select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLookupItems } from '@/hooks/use-lookup';
import { useSaveRecord } from '@/hooks/use-save-record';
import { api } from '@/lib/api';

type Sponsor = AdminBill['sponsors'][number];

/** Who initiated / co-sponsored the bill. Edited locally, saved as one list (PUT /bills/:id/sponsors). */
export function SponsorsSection({ bill }: { bill: AdminBill }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState<Sponsor[]>(bill.sponsors);
  const [sponsors, setSponsors] = useState<Sponsor[]>(bill.sponsors);
  const people = useLookupItems('persons', sponsors.map((s) => s.personId));
  const dirty = JSON.stringify(saved) !== JSON.stringify(sponsors);
  const save = useSaveRecord((list: Sponsor[]) => api.admin.bills.replaceSponsors(bill.id, { sponsors: list }), {
    invalidate: [['bills']],
    onSaved: ({ data }) => {
      setSaved(data.sponsors);
      setSponsors(data.sponsors);
      queryClient.setQueryData(['bill', data.id], { data });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('sponsors.title')}</CardTitle>
        <CardAction>
          <Button type="button" size="sm" disabled={!dirty || save.pending} onClick={() => save.submit(sponsors)}>
            <Save aria-hidden />
            {t('sponsors.save')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {sponsors.length === 0 && <p className="text-sm text-muted-foreground">{t('sponsors.empty')}</p>}
        <ul className="space-y-2" aria-label={t('sponsors.title')}>
          {sponsors.map((sponsor) => {
            const item = people.get(sponsor.personId);
            const name = item?.label ?? `#${sponsor.personId}`;
            return (
              <li key={sponsor.personId} className="flex items-center gap-2">
                <Avatar className="size-7">
                  {item?.imageUrl && <AvatarImage src={item.imageUrl} alt="" />}
                  <AvatarFallback className="text-xs">{Array.from(name.replace(/^.\./, ''))[0] ?? '?'}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate">
                  {name}
                  {item?.sublabel && <span className="ml-1 text-xs text-muted-foreground">{item.sublabel}</span>}
                </span>
                <Select
                  value={sponsor.role}
                  onValueChange={(role) => setSponsors((list) => list.map((s) => (s.personId === sponsor.personId ? { ...s, role: role as SponsorRole } : s)))}
                >
                  <SelectTrigger className="w-48" aria-label={t('sponsors.role', { name })}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPONSOR_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {t(`status.sponsorRole.${role}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('sponsors.remove', { name })}
                  onClick={() => setSponsors((list) => list.filter((s) => s.personId !== sponsor.personId))}
                >
                  <X aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
        <LookupSelect
          kind="persons"
          value={null}
          label={t('sponsors.add')}
          withImages
          onChange={(personId) => {
            if (personId === null || sponsors.some((s) => s.personId === personId)) return;
            setSponsors((list) => [...list, { personId, role: list.length === 0 ? 'initiator' : 'co_sponsor' }]);
          }}
        />
      </CardContent>
    </Card>
  );
}
