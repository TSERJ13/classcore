/**
 * Single source of truth for which emails count as SuperAdmin. This used to
 * be copy-pasted independently in five places (login/page.tsx, sa-login/page.tsx,
 * the superadmin layout, useUser.tsx, and the server-side auth check) and had
 * drifted: the superadmin layout recognized two more emails (admin@classcore.ge,
 * sergi.tsivtsivadze@gmail.com) than everywhere else, so someone logged in
 * under those emails could see the superadmin shell render but every API call
 * (which checked the narrower list) was rejected as unauthorized.
 */
export const SUPER_ADMIN_EMAILS = [
    'adminclasscore@gmail.com',
    'support@classcore.ge',
    'admin@classcore.ge',
    'sergi.tsivtsivadze@gmail.com',
];

export function isSuperAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    const normalized = email.toLowerCase();
    return SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === normalized);
}
