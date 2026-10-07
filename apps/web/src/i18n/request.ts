import { getRequestConfig } from 'next-intl/server';

// Single locale for now, no URL prefix. English will add routing (/en) later.
export default getRequestConfig(async () => {
  const locale = 'mn';
  return {
    locale,
    timeZone: 'Asia/Ulaanbaatar',
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
