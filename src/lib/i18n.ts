import { ka } from './i18n/ka';
import { en } from './i18n/en';
import { ru } from './i18n/ru';
import { Translations, Lang } from './i18n/types';
import { LANG_META } from './i18n/meta';

export type { Translations, Lang };
export { LANG_META };

export const translations: Record<Lang, Translations> = {
    ka,
    en,
    ru,
};
