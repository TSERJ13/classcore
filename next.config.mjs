/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    experimental: {
        serverComponentsExternalPackages: ['nodemailer', '@supabase/supabase-js', '@supabase/ssr'],
    },
};

export default nextConfig;
