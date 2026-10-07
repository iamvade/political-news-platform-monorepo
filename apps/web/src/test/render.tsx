import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import messages from '../../messages/mn.json';

/** Renders with the Mongolian messages and Ulaanbaatar time zone, like the app (src/i18n/request.ts). */
export function renderWithIntl(ui: ReactElement, options?: RenderOptions) {
  return render(
    // Missing keys throw, so every component test also checks that its strings exist in mn.json.
    <NextIntlClientProvider
      locale="mn"
      messages={messages}
      timeZone="Asia/Ulaanbaatar"
      onError={(error) => {
        throw error;
      }}
    >
      {ui}
    </NextIntlClientProvider>,
    options,
  );
}
