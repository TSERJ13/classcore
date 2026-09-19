'use server';

/**
 * SMS module rebuild — real balance display (classcore_sms_module_prd.pdf
 * v1.3 §10/§11: a persistent top-bar balance indicator, visible on every
 * SMS Manager tab). Read-only — never calls the send endpoint.
 *
 * Endpoint confirmed against GOSMS's own actively-maintained Node SDK
 * (github.com/gosms-ge/gosmsge-node, lib/index.ts, fetched 2026-09):
 * `POST https://api.gosms.ge/api/sms-balance` with JSON body `{api_key}`,
 * response `{success, balance, ...}` — same base URL/JSON-body style this
 * app's existing `/api/sms/send` already uses against `.../api/sendsms`,
 * which corroborates it. Not independently tested against a live key in
 * this environment (none configured here, and this pass deliberately
 * avoided any live GOSMS call while building it — sanity-check the first
 * real response shape once `GOSMS_API_KEY` is set in the deployment
 * environment).
 */

import { requireEffectivePermission } from '@/lib/permissions/enforce';
import { ok, fail, type ActionResult } from '@/lib/action-result';

export async function getSmsBalanceAction(): Promise<ActionResult<{ balance: number }>> {
    await requireEffectivePermission('canViewSMS');

    const apiKey = process.env.GOSMS_API_KEY;
    if (!apiKey) {
        return fail('not_configured', 'GOSMS_API_KEY is not configured — balance cannot be checked.');
    }

    try {
        const response = await fetch('https://api.gosms.ge/api/sms-balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: apiKey }),
        });
        const data = await response.json();
        const isSuccess = data?.success === true;
        if (!response.ok || !isSuccess) {
            return fail('balance_check_failed', data?.error || data?.message || `GOSMS balance check failed (${response.status})`);
        }
        const balance = Number(data?.balance);
        if (!Number.isFinite(balance)) return fail('invalid_response', 'GOSMS balance response did not include a numeric balance');
        return ok({ balance });
    } catch (err) {
        return fail('balance_check_failed', err instanceof Error ? err.message : 'Unknown error');
    }
}
