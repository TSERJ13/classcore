'use server';

/**
 * SMS module rebuild — AI auto-translation (classcore_sms_module_prd.pdf
 * v1.3 §7: admin writes one language, the other two are machine-translated
 * and remain hand-editable). Uses Google's Gemini API directly over HTTP
 * (no SDK dependency — the REST shape is simple enough that one wasn't
 * worth adding) per the user's choice of provider. Gated entirely behind
 * `GEMINI_API_KEY`; with no key set, this returns a clear "not configured"
 * error instead of throwing, matching the existing GOSMS_API_KEY-missing
 * pattern in src/app/api/sms/send/route.ts. Nothing else in the SMS module
 * depends on this — every other phase works with or without it.
 *
 * The key itself must only ever live as an environment variable (Vercel's
 * project settings for production, a local .env.local — already
 * gitignored — for dev). Never hardcode it here or anywhere else in the
 * repo.
 */

import { z } from 'zod';
import { requireEffectivePermission } from '@/lib/permissions/enforce';
import { ok, fail, type ActionResult } from '@/lib/action-result';

const LANG_NAMES: Record<'ka' | 'ru' | 'en', string> = { ka: 'Georgian', ru: 'Russian', en: 'English' };

// Every {placeholder} used across sms-service.ts's existing templates —
// the PRD's own list ({name},{studio},{plan},{group},{time},{coach},
// {days_left}) plus the ones already in production use here
// ({teacher},{student},{date},{amount}).
const PLACEHOLDER_NOTE = 'The text contains placeholders like {name}, {studio}, {plan}, {group}, {time}, {coach}, {days_left}, {teacher}, {student}, {date}, {amount} — copy any that appear through EXACTLY as-is, unchanged and untranslated, in the same position they make grammatical sense.';

const GEMINI_MODEL = 'gemini-flash-latest';

const translateSchema = z.object({
    text: z.string().trim().min(1).max(500),
    sourceLang: z.enum(['ka', 'ru', 'en']),
});

export type SmsTranslateResult = Partial<Record<'ka' | 'ru' | 'en', string>>;

export async function translateSmsTemplateAction(rawInput: unknown): Promise<ActionResult<SmsTranslateResult>> {
    const input = translateSchema.parse(rawInput);
    await requireEffectivePermission('canViewSMS');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return fail('not_configured', 'AI translation is not configured (missing GEMINI_API_KEY) — write the other languages by hand for now.');
    }

    const targets = (['ka', 'ru', 'en'] as const).filter(l => l !== input.sourceLang);
    const prompt = `You translate short SMS text for a dance/fitness studio management app, from ${LANG_NAMES[input.sourceLang]} into ${targets.map(t => LANG_NAMES[t]).join(' and ')}. ${PLACEHOLDER_NOTE} Respond with ONLY a single-line JSON object whose keys are the two-letter target language codes (${targets.join(', ')}) and whose values are the translations — no markdown formatting, no code fences, no explanation, nothing before or after the JSON.\n\nText to translate:\n${input.text}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });

        const data = await response.json();
        if (!response.ok) {
            return fail('translation_failed', data?.error?.message || `Gemini API error (${response.status})`);
        }

        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) return fail('empty_response', 'Translation returned no text');

        const cleaned = String(rawText).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(cleaned) as SmsTranslateResult;
        return ok(parsed);
    } catch (err) {
        if (err instanceof SyntaxError) return fail('parse_failed', 'Could not parse the translation response');
        return fail('translation_failed', err instanceof Error ? err.message : 'Unknown error');
    }
}
