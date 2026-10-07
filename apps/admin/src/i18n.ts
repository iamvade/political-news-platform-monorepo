import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import mn from './locales/mn.json';

void i18n.use(initReactI18next).init({
  lng: 'mn',
  fallbackLng: 'mn',
  resources: { mn: { translation: mn } },
  interpolation: { escapeValue: false },
});

export default i18n;
