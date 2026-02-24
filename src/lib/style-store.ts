/**
 * style-store.ts
 * Manages custom studio categories (dance styles, sports types, etc.)
 */

const STYLE_STORAGE_KEY = 'sf_custom_styles';

const DEFAULT_STYLES = ['Contemporary', 'Ballet', 'Hip-Hop', 'Salsa', 'Bachata', 'Tango', 'Jazz', 'Modern'];

export function getCustomStyles(): string[] {
    if (typeof window === 'undefined') return DEFAULT_STYLES;
    try {
        const stored = localStorage.getItem(STYLE_STORAGE_KEY);
        return stored ? JSON.parse(stored) : DEFAULT_STYLES;
    } catch {
        return DEFAULT_STYLES;
    }
}

export function saveCustomStyles(styles: string[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(styles));
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
