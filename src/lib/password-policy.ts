/**
 * Password strength policy — docs/authorization-module.md §5 (real PRD
 * upload, not the one I originally wrote from code archaeology): minimum 8
 * characters, one uppercase letter, one digit, one special character.
 *
 * Applied wherever a password is actually SET server-side (registration,
 * staff create/update) — client-side hints alone (registration wizard's
 * old getPasswordStrength()) never stopped a weak password from reaching
 * the server before this.
 */

export interface PasswordPolicyResult {
    valid: boolean;
    /** Which specific requirement failed, for a user-facing message. */
    reason?: 'length' | 'uppercase' | 'digit' | 'special';
}

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
    if (!password || password.length < 8) return { valid: false, reason: 'length' };
    if (!/[A-Z]/.test(password)) return { valid: false, reason: 'uppercase' };
    if (!/[0-9]/.test(password)) return { valid: false, reason: 'digit' };
    if (!/[^A-Za-z0-9]/.test(password)) return { valid: false, reason: 'special' };
    return { valid: true };
}

export function passwordPolicyMessage(reason: PasswordPolicyResult['reason'], l: (ka: string, ru: string, en: string) => string): string {
    switch (reason) {
        case 'length': return l('პაროლი უნდა შედგებოდეს მინიმუმ 8 სიმბოლოსგან', 'Пароль должен содержать минимум 8 символов', 'Password must be at least 8 characters');
        case 'uppercase': return l('პაროლი უნდა შეიცავდეს მინიმუმ ერთ დიდ ასოს', 'Пароль должен содержать хотя бы одну заглавную букву', 'Password must contain at least one uppercase letter');
        case 'digit': return l('პაროლი უნდა შეიცავდეს მინიმუმ ერთ ციფრს', 'Пароль должен содержать хотя бы одну цифру', 'Password must contain at least one digit');
        case 'special': return l('პაროლი უნდა შეიცავდეს მინიმუმ ერთ სპეციალურ სიმბოლოს', 'Пароль должен содержать хотя бы один специальный символ', 'Password must contain at least one special character');
        default: return l('პაროლი არასაკმარისად ძლიერია', 'Пароль недостаточно надежен', 'Password is not strong enough');
    }
}
