'use server';

/**
 * SMS module rebuild — AI auto-translation (classcore_sms_module_prd.pdf
 * v1.3 §7: admin writes one language, the other two are machine-translated
 * and remain hand-editable). The only new external dependency this phase
 * adds — gated entirely behind `ANTHROPIC_API_KEY`; with no key set, this
 * returns a clear "not configured" error instead of throwing, matching
 * the existing GOSMS_API_KEY-missing pattern in
 * src/app/api/sms/send/route.ts. Nothing else in the SMS module depends
 * on this — every other phase works with or without it.
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { requireEffectivePermission } from '@/lib/permissions/enforce';
import { ok, fail, type ActionResult } from '@/lib/action-result';

const LANG_NAMES: Record<'ka' | 'ru' | 'en', string> = { ka: 'Georgian', ru: 'Russian', en: 'English' };

// Every {placeholder} used across sms-service.ts's existing templates —
// the PRD's own list ({name},{studio},{plan},{group},{time},{coach},
// {days_left}) plus the ones already in production use here
// ({teacher},{student},{date},{amount}).
const PLACEHOLDER_NOTE = 'The text contains placeholders like {name}, {studio}, {plan}, {group}, {time}, {coach}, {days_left}, {teacher}, {student}, {date}, {amount} — copy any that appear through EXACTLY as-is, unchanged and untranslated, in the same position they make grammatical sense.';

const translateSchema = z.object({
    text: z.string().trim().min(1).max(500),
    sourceLang: z.enum(['ka', 'ru', 'en']),
});

export type SmsTranslateResult = Partial<Record<'ka' | 'ru' | 'en', string>>;

export async function translateSmsTemplateAction(rawInput: unknown): Promise<ActionResult<SmsTranslateResult>> {
    const input = translateSchema.parse(rawInput);
    await requireEffectivePermission('canViewSMS');

    if (!process.env.ANTHROPIC_API_KEY) {
        return fail('not_configured', 'AI translation is not configured (missing ANTHROPIC_API_KEY) — write the other languages by hand for now.');
    }

    const targets = (['ka', 'ru', 'en'] as const).filter(l => l !== input.sourceLang);
    const client = new Anthropic();

    try {
        const response = await client.messages.create({
            model: 'claude-opus-5',
            max_tokens: 1024,
            output_config: { effort: 'low' },
            system: `You translate short SMS text for a dance/fitness studio management app, from ${LANG_NAMES[input.sourceLang]} into ${targets.map(t => LANG_NAMES[t]).join(' and ')}. ${PLACEHOLDER_NOTE} Respond with ONLY a single-line JSON object whose keys are the two-letter target language codes (${targets.join(', ')}) and whose values are the translations — no markdown formatting, no code fences, no explanation, nothing before or after the JSON.`,
            messages: [{ role: 'user', content: input.text }],
        });

        const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
        if (!textBlock?.text) return fail('empty_response', 'Translation returned no text');

        const cleaned = textBlock.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(cleaned) as SmsTranslateResult;
        return ok(parsed);
    } catch (err) {
        if (err instanceof SyntaxError) return fail('parse_failed', 'Could not parse the translation response');
        if (err instanceof Anthropic.APIError) return fail('translation_failed', err.message);
        return fail('translation_failed', err instanceof Error ? err.message : 'Unknown error');
    }
}
