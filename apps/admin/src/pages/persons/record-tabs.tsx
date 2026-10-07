import {
  createDeclarationBodySchema,
  createStatementBodySchema,
  type AdminCorrection,
  type AdminDeclaration,
  type AdminStatement,
  type CreateDeclarationBody,
  type CreateStatementBody,
} from '@news/shared/schemas';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Pencil, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { DeleteButton } from '@/components/delete-button';
import { FormDialog } from '@/components/form-dialog';
import { FormField } from '@/components/form-field';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLookupItems } from '@/hooks/use-lookup';
import { useSaveRecord } from '@/hooks/use-save-record';
import { api } from '@/lib/api';
import { formatDate, formatMnt } from '@/lib/format';
import { orNull, schemaFieldErrors } from '@/lib/form-errors';
import { useSession } from '@/lib/session';
import { CorrectionDialog } from '@/pages/corrections/correction-dialog';

/** Records linked to a person, one tab each. Lists show the first 100 rows. */
export function PersonRecordTabs({ personId }: { personId: number }) {
  const { t } = useTranslation();
  return (
    <Tabs defaultValue="statements">
      <TabsList>
        <TabsTrigger value="statements">{t('records.tabs.statements')}</TabsTrigger>
        <TabsTrigger value="promises">{t('records.tabs.promises')}</TabsTrigger>
        <TabsTrigger value="declarations">{t('records.tabs.declarations')}</TabsTrigger>
        <TabsTrigger value="votes">{t('records.tabs.votes')}</TabsTrigger>
        <TabsTrigger value="corrections">{t('records.tabs.corrections')}</TabsTrigger>
      </TabsList>
      <TabsContent value="statements">
        <StatementsTab personId={personId} />
      </TabsContent>
      <TabsContent value="promises">
        <PromisesTab personId={personId} />
      </TabsContent>
      <TabsContent value="declarations">
        <DeclarationsTab personId={personId} />
      </TabsContent>
      <TabsContent value="votes">
        <VotesTab personId={personId} />
      </TabsContent>
      <TabsContent value="corrections">
        <CorrectionsTab personId={personId} />
      </TabsContent>
    </Tabs>
  );
}

function TabCard({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-3">
        {action && <div className="flex justify-end">{action}</div>}
        {children}
      </CardContent>
    </Card>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick}>
      <Plus aria-hidden />
      {label}
    </Button>
  );
}

function SourceLink({ url }: { url: string }) {
  const { t } = useTranslation();
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline underline-offset-2">
      <ExternalLink className="size-3" aria-hidden />
      {t('form.openSource')}
    </a>
  );
}

const Empty = ({ text }: { text: string }) => <p className="text-sm text-muted-foreground">{text}</p>;

// --- Statements -------------------------------------------------------------------------------------------------

function StatementsTab({ personId }: { personId: number }) {
  const { t } = useTranslation();
  const isAdmin = useSession().user?.role === 'admin';
  const [editing, setEditing] = useState<AdminStatement | 'new' | null>(null);
  const query = useQuery({ queryKey: ['statements', { personId }], queryFn: () => api.admin.statements.list({ personId, pageSize: 100 }) });
  const remove = useSaveRecord((id: number) => api.admin.statements.remove(id), { invalidate: [['statements']], successMessage: t('form.deleted') });
  const rows = query.data?.data ?? [];

  return (
    <TabCard action={<AddButton label={t('statements.add')} onClick={() => setEditing('new')} />}>
      {rows.length === 0 && query.isSuccess && <Empty text={t('statements.empty')} />}
      <ul className="divide-y">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0 space-y-1">
              <blockquote className="border-l-2 pl-3">{row.quoteMn}</blockquote>
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDate(row.saidOn)}</span>
                {row.contextMn && <span>· {row.contextMn}</span>}
                <SourceLink url={row.sourceUrl} />
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t('statements.edit')} onClick={() => setEditing(row)}>
                <Pencil aria-hidden />
              </Button>
              {isAdmin && <DeleteButton label={t('statements.delete')} onConfirm={() => remove.submit(row.id)} />}
            </div>
          </li>
        ))}
      </ul>
      {editing && <StatementDialog personId={personId} statement={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </TabCard>
  );
}

function StatementDialog({ personId, statement, onClose }: { personId: number; statement: AdminStatement | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [quoteMn, setQuoteMn] = useState(statement?.quoteMn ?? '');
  const [contextMn, setContextMn] = useState(statement?.contextMn ?? '');
  const [saidOn, setSaidOn] = useState(statement?.saidOn ?? '');
  const [sourceUrl, setSourceUrl] = useState(statement?.sourceUrl ?? '');
  const save = useSaveRecord(
    (body: CreateStatementBody) => (statement ? api.admin.statements.update(statement.id, body) : api.admin.statements.create(body)),
    { invalidate: [['statements']], onSaved: onClose },
  );
  const errors = save.errors;

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t(statement ? 'statements.editTitle' : 'statements.newTitle')}
      submitting={save.pending}
      onSubmit={() => {
        const body = { personId, quoteMn: quoteMn.trim(), contextMn: orNull(contextMn), saidOn, sourceUrl: sourceUrl.trim() };
        save.submit(body, schemaFieldErrors(createStatementBodySchema.safeParse(body)));
      }}
    >
      <FormField id="statement-quote" label={t('statements.fields.quoteMn')} error={errors.quoteMn} required>
        <Textarea id="statement-quote" value={quoteMn} onChange={(event) => setQuoteMn(event.target.value)} rows={4} maxLength={5000} aria-invalid={!!errors.quoteMn} />
      </FormField>
      <FormField id="statement-context" label={t('statements.fields.contextMn')} error={errors.contextMn}>
        <Input id="statement-context" value={contextMn} onChange={(event) => setContextMn(event.target.value)} maxLength={2000} />
      </FormField>
      <FormField id="statement-saidOn" label={t('statements.fields.saidOn')} error={errors.saidOn} required>
        <Input id="statement-saidOn" type="date" value={saidOn} onChange={(event) => setSaidOn(event.target.value)} aria-invalid={!!errors.saidOn} />
      </FormField>
      <FormField id="statement-source" label={t('form.sourceUrl')} error={errors.sourceUrl} hint={t('form.sourceHint')} required>
        <Input id="statement-source" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://" aria-invalid={!!errors.sourceUrl} />
      </FormField>
    </FormDialog>
  );
}

// --- Promises ---------------------------------------------------------------------------------------------------

function PromisesTab({ personId }: { personId: number }) {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['promises', { personId }], queryFn: () => api.admin.promises.list({ personId, pageSize: 100 }) });
  const rows = query.data?.data ?? [];
  return (
    <TabCard
      action={
        <Button asChild size="sm" variant="outline">
          <Link to={`/promises/new?personId=${personId}`}>
            <Plus aria-hidden />
            {t('promises.add')}
          </Link>
        </Button>
      }
    >
      {rows.length === 0 && query.isSuccess && <Empty text={t('promises.empty')} />}
      <ul className="divide-y">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0 space-y-1">
              <Link to={`/promises/${row.id}`} className="font-medium hover:underline">
                {row.textMn}
              </Link>
              <p className="text-xs text-muted-foreground">{formatDate(row.madeOn)}</p>
            </div>
            <StatusBadge group="promise" value={row.status} />
          </li>
        ))}
      </ul>
    </TabCard>
  );
}

// --- Declarations -----------------------------------------------------------------------------------------------

function DeclarationsTab({ personId }: { personId: number }) {
  const { t } = useTranslation();
  const isAdmin = useSession().user?.role === 'admin';
  const [editing, setEditing] = useState<AdminDeclaration | 'new' | null>(null);
  const query = useQuery({ queryKey: ['declarations', { personId }], queryFn: () => api.admin.declarations.list({ personId, pageSize: 100 }) });
  const remove = useSaveRecord((id: number) => api.admin.declarations.remove(id), { invalidate: [['declarations']], successMessage: t('form.deleted') });
  const rows = query.data?.data ?? [];

  return (
    <TabCard action={<AddButton label={t('declarations.add')} onClick={() => setEditing('new')} />}>
      {rows.length === 0 && query.isSuccess ? (
        <Empty text={t('declarations.empty')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('declarations.fields.year')}</TableHead>
              <TableHead className="text-right">{t('declarations.fields.income')}</TableHead>
              <TableHead className="text-right">{t('declarations.fields.assets')}</TableHead>
              <TableHead className="text-right">{t('declarations.fields.liabilities')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-medium">{row.year}</div>
                  <SourceLink url={row.sourceUrl} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatMnt(row.income)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMnt(row.assets)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMnt(row.liabilities)}</TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={t('declarations.edit', { year: row.year })} onClick={() => setEditing(row)}>
                    <Pencil aria-hidden />
                  </Button>
                  {isAdmin && <DeleteButton label={t('declarations.delete', { year: row.year })} onConfirm={() => remove.submit(row.id)} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {editing && <DeclarationDialog personId={personId} declaration={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </TabCard>
  );
}

function DeclarationDialog({ personId, declaration, onClose }: { personId: number; declaration: AdminDeclaration | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [year, setYear] = useState(declaration ? String(declaration.year) : '');
  const [filedOn, setFiledOn] = useState(declaration?.filedOn ?? '');
  const [income, setIncome] = useState(declaration?.income ?? '');
  const [assets, setAssets] = useState(declaration?.assets ?? '');
  const [liabilities, setLiabilities] = useState(declaration?.liabilities ?? '');
  const [sourceUrl, setSourceUrl] = useState(declaration?.sourceUrl ?? '');
  const save = useSaveRecord(
    (body: CreateDeclarationBody) => (declaration ? api.admin.declarations.update(declaration.id, body) : api.admin.declarations.create(body)),
    { invalidate: [['declarations']], onSaved: onClose },
  );
  const errors = save.errors;
  const amount = (value: string) => orNull(value.replace(/[\s,]/g, ''));

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t(declaration ? 'declarations.editTitle' : 'declarations.newTitle')}
      description={t('declarations.amountsHint')}
      submitting={save.pending}
      onSubmit={() => {
        const body = {
          personId,
          year: /^\d{4}$/.test(year) ? Number(year) : 0,
          filedOn: filedOn || null,
          income: amount(income),
          assets: amount(assets),
          liabilities: amount(liabilities),
          sourceUrl: sourceUrl.trim(),
        };
        save.submit(body, schemaFieldErrors(createDeclarationBodySchema.safeParse(body)));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="declaration-year" label={t('declarations.fields.year')} error={errors.year} required>
          <Input id="declaration-year" inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value)} maxLength={4} aria-invalid={!!errors.year} />
        </FormField>
        <FormField id="declaration-filedOn" label={t('declarations.fields.filedOn')} error={errors.filedOn}>
          <Input id="declaration-filedOn" type="date" value={filedOn} onChange={(event) => setFiledOn(event.target.value)} />
        </FormField>
        {(
          [
            ['income', income, setIncome],
            ['assets', assets, setAssets],
            ['liabilities', liabilities, setLiabilities],
          ] as const
        ).map(([field, value, set]) => (
          <FormField key={field} id={`declaration-${field}`} label={t(`declarations.fields.${field}`)} error={errors[field]}>
            <Input id={`declaration-${field}`} inputMode="decimal" value={value} onChange={(event) => set(event.target.value)} aria-invalid={!!errors[field]} />
          </FormField>
        ))}
      </div>
      <FormField id="declaration-source" label={t('form.sourceUrl')} error={errors.sourceUrl} hint={t('form.sourceHint')} required>
        <Input id="declaration-source" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://" aria-invalid={!!errors.sourceUrl} />
      </FormField>
    </FormDialog>
  );
}

// --- Votes (read-only; entered per bill) ---------------------------------------------------------------------------

function VotesTab({ personId }: { personId: number }) {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['votes', { personId }], queryFn: () => api.admin.votes.list({ personId, pageSize: 100 }) });
  const rows = query.data?.data ?? [];
  const bills = useLookupItems('bills', [...new Set(rows.map((row) => row.billId))]);

  return (
    <TabCard>
      <p className="text-xs text-muted-foreground">{t('votes.enteredPerBill')}</p>
      {rows.length === 0 && query.isSuccess ? (
        <Empty text={t('votes.empty')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('votes.fields.bill')}</TableHead>
              <TableHead>{t('votes.fields.date')}</TableHead>
              <TableHead>{t('votes.fields.motion')}</TableHead>
              <TableHead>{t('votes.fields.value')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link to={`/bills/${row.billId}`} className="hover:underline">
                    {bills.get(row.billId)?.label ?? `#${row.billId}`}
                  </Link>
                </TableCell>
                <TableCell>{formatDate(row.date)}</TableCell>
                <TableCell>
                  <code className="text-xs">{row.motion}</code>
                </TableCell>
                <TableCell>
                  <StatusBadge group="vote" value={row.value} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </TabCard>
  );
}

// --- Corrections ------------------------------------------------------------------------------------------------

function CorrectionsTab({ personId }: { personId: number }) {
  const { t } = useTranslation();
  const isAdmin = useSession().user?.role === 'admin';
  const [editing, setEditing] = useState<AdminCorrection | 'new' | null>(null);
  const query = useQuery({
    queryKey: ['corrections', { entityType: 'person', entityId: personId }],
    queryFn: () => api.admin.corrections.list({ entityType: 'person', entityId: personId, pageSize: 100 }),
  });
  const remove = useSaveRecord((id: number) => api.admin.corrections.remove(id), { invalidate: [['corrections']], successMessage: t('form.deleted') });
  const rows = query.data?.data ?? [];

  return (
    <TabCard action={<AddButton label={t('corrections.add')} onClick={() => setEditing('new')} />}>
      {rows.length === 0 && query.isSuccess && <Empty text={t('corrections.empty')} />}
      <ul className="divide-y">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0 space-y-1">
              <p>{row.description}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(row.date)} · {row.reason}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t('corrections.edit')} onClick={() => setEditing(row)}>
                <Pencil aria-hidden />
              </Button>
              {isAdmin && <DeleteButton label={t('corrections.delete')} onConfirm={() => remove.submit(row.id)} />}
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <CorrectionDialog correction={editing === 'new' ? null : editing} target={{ entityType: 'person', entityId: personId }} onClose={() => setEditing(null)} />
      )}
    </TabCard>
  );
}
