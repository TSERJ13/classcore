/**
 * style-store.ts
 * Manages custom studio categories (dance styles, sports types, etc.)
 */

import { getScopedKey } from './settings-store';

const BASE_STYLE_STORAGE_KEY = 'cc_custom_styles';
function getStyleKey() { return getScopedKey(BASE_STYLE_STORAGE_KEY); }

const DEFAULT_STYLES = ['Contemporary', 'Ballet', 'Hip-Hop', 'Salsa', 'Bachata', 'Tango', 'Jazz', 'Modern'];

export function getCustomStyles(): string[] {
    if (typeof window === 'undefined') return DEFAULT_STYLES;
    try {
        const key = getStyleKey();
        let stored = localStorage.getItem(key);

        // Migration
        if (!stored && key !== BASE_STYLE_STORAGE_KEY) {
            stored = localStorage.getItem(BASE_STYLE_STORAGE_KEY);
        }

        const parsed = JSON.parse(stored || '[]');
        return Array.isArray(parsed) ? parsed : DEFAULT_STYLES;
    } catch {
        return DEFAULT_STYLES;
    }
}

export function saveCustomStyles(styles: string[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getStyleKey(), JSON.stringify(styles));
}

export function addCustomStyle(style: string): void {
    const styles = getCustomStyles();
    if (!styles.includes(style)) {
        saveCustomStyles([...styles, style]);
    }
}

export function removeCustomStyle(style: string): void {
    const styles = getCustomStyles();
    saveCustomStyles(styles.filter(s => s !== style));
}
