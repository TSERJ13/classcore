import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'ClassCore | Studio Management',
        short_name: 'ClassCore',
        description: 'Universal CRM for dance studios and sports schools.',
        start_url: '/',
        display: 'standalone',
        background_color: '#6366f1',
        theme_color: '#6366f1',
        icons: [
            {
                src: '/logo.svg',
                sizes: 'any',
                type: 'image/x-icon',
            },
            {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
            },
            {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
    };
}
