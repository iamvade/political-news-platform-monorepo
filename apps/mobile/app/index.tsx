import { isApiError } from '@news/shared/api-client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../src/api';

type Status = { kind: 'checking' } | { kind: 'ok' } | { kind: 'error'; code: string };

export default function HomeScreen() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>({ kind: 'checking' });

  useEffect(() => {
    const controller = new AbortController();
    api.health
      .ready({ signal: controller.signal })
      .then(() => setStatus({ kind: 'ok' }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setStatus({ kind: 'error', code: isApiError(err) ? err.code : 'UNKNOWN' });
      });
    return () => controller.abort();
  }, []);

  const label =
    status.kind === 'checking' ? t('home.checking') : status.kind === 'ok' ? t('home.ok') : t('home.error', { code: status.code });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('home.heading')}</Text>
      <Text>
        {t('home.apiStatus')}: {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  heading: { fontSize: 24, fontWeight: '700' },
});
