/**
 * Signed staff-session tokens.
 *
 * Replaces the old `cc_staff_auth=true` cookie, which was a plain,
 * unsigned marker anyone could set themselves in devtools
 * (`document.cookie = "cc_staff_auth=true"`) to be treated as a logged-in
 * staff member by middleware.ts and session-check.ts. A token minted here
 * can only be produced by this server (it requires STAFF_SESSION_SECRET),
 * and it carries WHICH staff member / org it belongs to, so downstream
 * code can scope data access to that org instead of trusting a global
 * "some staff member, somewhere" flag.
 *
 * Uses Web Crypto (`crypto.subtle`) rather than Node's `crypto` module
 * because this is verified from middleware.ts, which Next.js runs on the
 * Edge runtime — Node's `crypto` module is not available there, but
 * Web Crypto is available in both Edge and Node.
 *
 * If STAFF_SESSION_SECRET is not configured, signing/verification both
 * fail closed (return null) rather than falling back to the old trust-any
 * behavior — an unconfigured deployment should not silently reopen the
 * hole this replaces.
 */

export interface StaffTokenPayload {
    staffId: string;
    orgId: string;
    slug: string;
    exp: number; // epoch ms
}

function getSecret(): string | null {
    return process.env.STAFF_SESSION_SECRET || null;
}

function toBase64Url(bytes: Uint8Array): string {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

function fromBase64Url(str: string): Uint8Array {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + (4 - (str.length % 4 || 4)) % 4, '=');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

async function getKey(secret: string): Promise<CryptoKey> {
    const enc = new TextEncoder().encode(secret);
    return crypto.subtle.importKey('raw', enc, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function sign(data: string, secret: string): Promise<string> {
    const key = await getKey(secret);
    const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return toBase64Url(new Uint8Array(sigBuf));
}

export async function createStaffToken(payload: Omit<StaffTokenPayload, 'exp'>, ttlMs = 1000 * 60 * 60 * 24 * 7): Promise<string | null> {
    const secret = getSecret();
    if (!secret) {
        console.error('❌ [staff-token] STAFF_SESSION_SECRET is not set — refusing to mint a staff session token.');
        return null;
    }
    const full: StaffTokenPayload = { ...payload, exp: Date.now() + ttlMs };
    const body = toBase64Url(new TextEncoder().encode(JSON.stringify(full)));
    const sig = await sign(body, secret);
    return `${body}.${sig}`;
}

export async function verifyStaffToken(token: string | null | undefined): Promise<StaffTokenPayload | null> {
    if (!token) return null;
    const secret = getSecret();
    if (!secret) return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;

    const expectedSig = await sign(body, secret);
    if (!constantTimeEqual(sig, expectedSig)) return null;

    try {
        const json = new TextDecoder().decode(fromBase64Url(body));
        const payload = JSON.parse(json) as StaffTokenPayload;
        if (!payload.exp || Date.now() > payload.exp) return null;
        if (!payload.staffId || !payload.orgId || !payload.slug) return null;
        return payload;
    } catch {
        return null;
    }
}
