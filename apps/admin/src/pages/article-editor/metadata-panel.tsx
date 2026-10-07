import type { AuthUser, LookupItem } from '@news/shared/schemas';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LookupMultiSelect } from '@/components/lookup-multi-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { CoverField } from './cover-field';
import { useEditorState, type EditorStore } from './editor-store';

const NO_CATEGORY = 'none';

interface MetadataPanelProps {
  store: EditorStore;
  user: AuthUser;
  disabled: boolean;
}

export function MetadataPanel({ store, user, disabled }: MetadataPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { values } = useEditorState(store);
  const categories = useQuery({ queryKey: ['lookup', 'categories', 'all'], queryFn: () => api.lookup.search('categories', { limit: 50 }), staleTime: 5 * 60_000 });
  const canCreateTags = user.role === 'editor' || user.role === 'admin';

  async function createTag(name: string): Promise<LookupItem> {
    const { data } = await api.taxonomy.createTag({ nameMn: name });
    void queryClient.invalidateQueries({ queryKey: ['lookup', 'tags'] });
    return { id: data.id, label: data.nameMn, sublabel: null, imageUrl: null };
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('editor.metadata.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="article-category">{t('editor.fields.categoryId')}</Label>
          <Select
            value={values.categoryId === null ? NO_CATEGORY : String(values.categoryId)}
            onValueChange={(value) => store.update({ categoryId: value === NO_CATEGORY ? null : Number(value) })}
            disabled={disabled}
          >
            <SelectTrigger id="article-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>{t('editor.metadata.noCategory')}</SelectItem>
              {categories.data?.data.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="article-lede">{t('editor.fields.lede')}</Label>
          <Textarea
            id="article-lede"
            value={values.lede}
            onChange={(event) => store.update({ lede: event.target.value })}
            maxLength={1000}
            rows={4}
            disabled={disabled}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="article-breaking">{t('editor.fields.isBreaking')}</Label>
          <Switch id="article-breaking" checked={values.isBreaking} onCheckedChange={(checked) => store.update({ isBreaking: checked })} disabled={disabled} />
        </div>

        <div className="space-y-1.5">
          <Label>{t('editor.fields.coverMediaId')}</Label>
          <CoverField value={values.coverMediaId} onChange={(coverMediaId) => store.update({ coverMediaId })} disabled={disabled} />
        </div>

        <div className="space-y-1.5">
          <Label>{t('editor.fields.tagIds')}</Label>
          <LookupMultiSelect
            kind="tags"
            label={t('editor.fields.tagIds')}
            value={values.tagIds}
            onChange={(tagIds) => store.update({ tagIds })}
            onCreate={canCreateTags ? createTag : undefined}
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t('editor.fields.personIds')}</Label>
          <LookupMultiSelect
            kind="persons"
            label={t('editor.fields.personIds')}
            value={values.personIds}
            onChange={(personIds) => store.update({ personIds })}
            withImages
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t('editor.fields.organizationIds')}</Label>
          <LookupMultiSelect
            kind="organizations"
            label={t('editor.fields.organizationIds')}
            value={values.organizationIds}
            onChange={(organizationIds) => store.update({ organizationIds })}
            withImages
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t('editor.fields.billIds')}</Label>
          <LookupMultiSelect
            kind="bills"
            label={t('editor.fields.billIds')}
            value={values.billIds}
            onChange={(billIds) => store.update({ billIds })}
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
