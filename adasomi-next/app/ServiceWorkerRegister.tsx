'use client';

import { useEffect } from 'react';

/** Registers the PWA service worker once the page has loaded, client-side only. */
export default function ServiceWorkerRegister() {
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

        const register = () => {
            navigator.serviceWorker.register('/sw.js').catch(() => {
                // Non-fatal: app still works without offline/installable support.
            });
        };

        if (document.readyState === 'complete') {
            register();
        } else {
            window.addEventListener('load', register, { once: true });
        }
    }, []);

    return null;
}
