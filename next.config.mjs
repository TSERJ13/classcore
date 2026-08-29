import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    register: true,
    skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        // Left as `true`: `next lint` currently reports 300+ pre-existing
        // issues across the codebase (mostly unused imports and `any`
        // types, a handful of missing-dependency warnings) — real cleanup
        // work, but style/lint issues rather than correctness bugs, and
        // turning this off would block every deploy until all of them are
        // fixed. Recommend tackling this as a separate cleanup pass with
        // `npx next lint` and re-enabling once it's clean.
        ignoreDuringBuilds: true,
    },
    typescript: {
        // Was `ignoreBuildErrors: true` — silently hid real TypeScript errors
        // (8 were live in the codebase, including two dead-field reads that
        // matched the reported "history/attendance sometimes wrong" bugs)
        // from every production deploy. Re-enabled as part of the diagnostic
        // fixes; `npx tsc --noEmit` is clean as of this change.
        ignoreBuildErrors: false,
    },
    experimental: {
        serverComponentsExternalPackages: ['nodemailer', '@supabase/supabase-js', '@supabase/ssr'],
    },
};

export default withPWA(nextConfig);
