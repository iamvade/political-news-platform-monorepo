import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { Inter, Source_Serif_4 } from 'next/font/google';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { serverEnv, siteUrl } from '@/lib/env';
import { themeScript } from '@/lib/theme';
import './globals.css';

// cyrillic-ext carries the Mongolian letters Ө ө Ү ү (verified in the built font files; see docs/technical/features/design-system.md).
// No `opsz` axis: it almost doubles the serif download. Only the serif (headlines, the likely text LCP) is
// preloaded (~101 KB); Inter loads when the CSS needs it, leaving early bandwidth to the hero image.
const serif = Source_Serif_4({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-source-serif',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-inter',
  display: 'swap',
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  const site = siteUrl();
  const facebookAppId = serverEnv().FACEBOOK_APP_ID;
  return {
    metadataBase: new URL(site),
    title: { default: t('title'), template: `%s | ${t('title')}` },
    description: t('description'),
    openGraph: { type: 'website', siteName: t('title'), locale: 'mn_MN', title: t('title'), description: t('description'), url: `${site}/` },
    twitter: { card: 'summary_large_image', title: t('title'), description: t('description') },
    ...(facebookAppId && { facebook: { appId: facebookAppId } }),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    // data-theme is set by the inline script before hydration, hence suppressHydrationWarning.
    <html lang={locale} className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-canvas font-sans text-ink antialiased">
        {/* Client components only need these namespaces; the rest stays on the server (smaller HTML payload). */}
        <NextIntlClientProvider messages={{ nav: messages.nav, theme: messages.theme, errors: messages.errors }}>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
