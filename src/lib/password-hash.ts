/**
 * Password hashing for the `staff` table — see
 * docs/architecture-migration.md §10's flagged security note: staff
 * passwords were stored (and compared) in plaintext. Uses Node's built-in
 * `crypto.scrypt` rather than adding a new dependency (bcrypt/argon2 aren't
 * already in package.json).
 *
 * Self-describing format (`scrypt$<saltHex>$<hashHex>`) so a stored value
 * can be told apart from a pre-existing plaintext row without a separate
 * "is this hashed" column — existing plaintext rows keep working via
 * verifyPassword()'s fallback comparison, and get upgraded to a hash the
 * next time that user logs in successfully (see staff-login/route.ts) or
 * is edited through the Staff Server Actions.
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCallback);
const PREFIX = 'scrypt';
const KEY_LENGTH = 64;

export function isHashedPassword(value: string | null | undefined): boolean {
    return !!value && value.startsWith(`${PREFIX}$`);
}

export async function hashPassword(plain: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derived = (await scrypt(plain, salt, KEY_LENGTH)) as Buffer;
    return `${PREFIX}$${salt}$${derived.toString('hex')}`;
}

/** Verifies against a hashed value, or falls back to a direct compare for a legacy plaintext row. */
export async function verifyPassword(plain: string, stored: string | null | undefined): Promise<boolean> {
    if (!stored) return false;
    if (!isHashedPassword(stored)) {
        return stored === plain;
    }
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const [, salt, hashHex] = parts;
    if (!salt || !hashHex) return false;
    try {
        const derived = (await scrypt(plain, salt, KEY_LENGTH)) as Buffer;
        const storedBuf = Buffer.from(hashHex, 'hex');
        if (storedBuf.length !== derived.length) return false;
        return timingSafeEqual(derived, storedBuf);
    } catch {
        return false;
    }
}
