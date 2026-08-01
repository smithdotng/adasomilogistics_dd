import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegister from './ServiceWorkerRegister';

const SITE_URL = 'https://deliveries.adasomilogistics.com';
const SITE_TITLE = 'Adasomi Logistics Dispatch & Delivery Platform';
const SITE_DESCRIPTION =
    'Adasomi Logistics Dispatch & Delivery Platform - multi-party logistics for merchants, riders and public users.';

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: SITE_TITLE,
        template: '%s | Adasomi'
    },
    description: SITE_DESCRIPTION,
    manifest: '/manifest.webmanifest',
    icons: {
        icon: '/images/logo.png',
        apple: '/icons/icon-192.png'
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'Adasomi'
    },
    openGraph: {
        type: 'website',
        url: SITE_URL,
        siteName: 'Adasomi Logistics',
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        images: [
            {
                url: '/images/og-image.jpg',
                width: 1200,
                height: 1200,
                alt: 'Adasomi Logistics - fast and reliable'
            }
        ]
    },
    twitter: {
        card: 'summary_large_image',
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        images: ['/images/og-image.jpg']
    }
};

export const viewport: Viewport = {
    themeColor: '#2f7dd8'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
                    rel="stylesheet"
                />
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.2/css/bootstrap.min.css" />
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
            </head>
            <body>
                {children}
                <script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.2/js/bootstrap.bundle.min.js" async />
                <ServiceWorkerRegister />
            </body>
        </html>
    );
}
