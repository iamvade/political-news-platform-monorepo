import { useTranslation } from 'react-i18next';
import { MediaField } from '@/components/media-field';

interface CoverFieldProps {
  value: number | null;
  onChange: (mediaId: number | null) => void;
  disabled?: boolean;
}

/** Cover image: chosen from the media library; alt text and credit are required (API: MEDIA_NOT_USABLE). */
export function CoverField({ value, onChange, disabled }: CoverFieldProps) {
  const { t } = useTranslation();
  return (
    <MediaField
      value={value}
      onChange={onChange}
      disabled={disabled}
      purpose="cover"
      labels={{ choose: t('editor.cover.choose'), change: t('editor.cover.change'), remove: t('editor.cover.remove') }}
    />
  );
}
