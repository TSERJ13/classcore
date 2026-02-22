// ─── Settings Store ─────────────────────────────────────────────────────────
// All studio branding + theme settings persisted in localStorage.

export type ThemeKey = 'indigo' | 'violet' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'fuchsia';
export type BgKey = 'charcoal' | 'slate' | 'midnight' | 'zinc' | 'abyss' | 'forest' | 'cosmos';

export interface StudioSettings {
    studioName: string;
    studioSlug: string;
    logoDataUrl: string | null;   // base64 image or null
    themeKey: ThemeKey;
    bgKey: BgKey;
    accentColor: string;          // CSS HSL value
    notifications: {
        newStudent: boolean;
        lowSessions: boolean;
        dailyReport: boolean;
        telegramBot: boolean;
    };
    security: {
        twoFactor: boolean;
        sessionTimeout: number; // minutes
    };
}

export const THEMES: Record<ThemeKey, { label: string; accent: string; accentHex: string; bg: string; text: string; border: string; from: string; to: string }> = {
    indigo: { label: 'Indigo', accent: '239 84% 67%', accentHex: '#6366f1', bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30', from: 'from-indigo-500', to: 'to-violet-600' },
    violet: { label: 'Violet', accent: '262 83% 68%', accentHex: '#8b5cf6', bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30', from: 'from-violet-500', to: 'to-purple-600' },
    emerald: { label: 'Emerald', accent: '158 64% 52%', accentHex: '#10b981', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', from: 'from-emerald-500', to: 'to-teal-600' },
    rose: { label: 'Rose', accent: '347 77% 61%', accentHex: '#f43f5e', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', from: 'from-rose-500', to: 'to-pink-600' },
    amber: { label: 'Amber', accent: '38 92% 50%', accentHex: '#f59e0b', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', from: 'from-amber-500', to: 'to-orange-600' },
    cyan: { label: 'Cyan', accent: '189 94% 43%', accentHex: '#06b6d4', bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30', from: 'from-cyan-500', to: 'to-blue-600' },
    fuchsia: { label: 'Fuchsia', accent: '292 91% 63%', accentHex: '#e879f9', bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30', from: 'from-fuchsia-500', to: 'to-purple-600' },
};

export type BgTheme = { label: string; base: string; surface: string; card: string; preview: string };
export const BG_THEMES: Record<BgKey, BgTheme> = {
    charcoal: { label: 'Charcoal', base: '#0e0e12', surface: '#111116', card: '#161620', preview: 'bg-[#0e0e12]' },
    slate: { label: 'Slate', base: '#0d1117', surface: '#161b22', card: '#1c2128', preview: 'bg-[#0d1117]' },
    midnight: { label: 'Midnight', base: '#080c14', surface: '#0d1424', card: '#121c30', preview: 'bg-[#080c14]' },
    zinc: { label: 'Zinc', base: '#18181b', surface: '#1c1c1f', card: '#212125', preview: 'bg-[#18181b]' },
    abyss: { label: 'Abyss', base: '#050508', surface: '#0a0a0f', card: '#0f0f16', preview: 'bg-[#050508]' },
    forest: { label: 'Forest', base: '#071310', surface: '#0c1c18', card: '#112420', preview: 'bg-[#071310]' },
    cosmos: { label: 'Cosmos', base: '#0c0a14', surface: '#120f1e', card: '#181428', preview: 'bg-[#0c0a14]' },
    white: { label: 'თეთრი', base: '#ffffff', surface: '#f8f9fa', card: '#ffffff', preview: 'bg-[#ffffff]' },
    ivory: { label: 'სპილოს ძვალი', base: '#fefcf8', surface: '#faf8f3', card: '#ffffff', preview: 'bg-[#fefcf8]' },
    cocoa: { label: 'კაკაოს ფერი', base: '#f5f1eb', surface: '#ede8e0', card: '#ffffff', preview: 'bg-[#f5f1eb]' },
};

const STORAGE_KEY = 'sf_studio_settings';

const DEFAULT_SETTINGS: StudioSettings = {
    studioName: 'Demo Dance Studio',
    studioSlug: 'demo-dance',
    logoDataUrl: null,
    themeKey: 'indigo',
    bgKey: 'charcoal',
    accentColor: '239 84% 67%',
    notifications: {
        newStudent: true,
        lowSessions: true,
        dailyReport: false,
        telegramBot: true,
    },
    security: {
        twoFactor: false,
        sessionTimeout: 60,
    },
};

export function loadSettings(): StudioSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export function saveSettings(s: Partial<StudioSettings>): StudioSettings {
    const current = loadSettings();
    const next = { ...current, ...s };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
    return next;
}

export function patchNotifications(patch: Partial<StudioSettings['notifications']>): StudioSettings {
    const current = loadSettings();
    return saveSettings({ notifications: { ...current.notifications, ...patch } });
}

export function patchSecurity(patch: Partial<StudioSettings['security']>): StudioSettings {
    const current = loadSettings();
    return saveSettings({ security: { ...current.security, ...patch } });
}

/** Apply accent CSS variable to :root */
export function applyTheme(themeKey: ThemeKey) {
    const theme = THEMES[themeKey];
    if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--accent', theme.accent);
        document.documentElement.style.setProperty('--accent-hex', theme.accentHex);
    }
}

/** Apply background CSS variables to :root */
export function applyBg(bgKey: BgKey) {
    const bg = BG_THEMES[bgKey];
    if (typeof document !== 'undefined') {
        // Set CSS variables
        document.documentElement.style.setProperty('--bg-base', bg.base);
        document.documentElement.style.setProperty('--bg-surface', bg.surface);
        document.documentElement.style.setProperty('--bg-card', bg.card);
        
        // Apply to body directly
        document.body.style.background = bg.base;
        document.body.style.transition = 'background-color 0.3s ease';
        
        // Apply to html element as well
        document.documentElement.style.background = bg.base;
        
        // For light themes, adjust text colors
        const isLight = ['white', 'ivory', 'cocoa'].includes(bgKey);
        if (isLight) {
            document.documentElement.classList.add('light-theme');
        } else {
            document.documentElement.classList.remove('light-theme');
        }
        
        // Force reflow to ensure styles are applied
        document.body.offsetHeight;
    }
}
