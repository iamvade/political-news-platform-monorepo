import '../src/i18n';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function RootLayout() {
  const { t } = useTranslation();
  return <Stack screenOptions={{ title: t('app.title') }} />;
}
