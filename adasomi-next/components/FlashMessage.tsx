'use client';

import { useEffect, useState } from 'react';

interface FlashMessageProps {
    success?: string;
    error?: string;
    info?: string;
}

function Alert({ kind, message, onClose }: { kind: 'success' | 'error' | 'info'; message: string; onClose: () => void }) {
    const styles: Record<string, { bg: string; color: string; icon: string }> = {
        success: { bg: '#e3f8ea', color: '#1f8a52', icon: 'fa-circle-check' },
        error: { bg: '#fdeceb', color: '#c8392f', icon: 'fa-triangle-exclamation' },
        info: { bg: '#eaf5fb', color: '#2b6cd4', icon: 'fa-circle-info' }
    };
    const s = styles[kind];

    return (
        <div className="container mt-3">
            <div
                className="alert alert-dismissible fade show"
                role="alert"
                style={{ borderRadius: 10, border: 'none', background: s.bg, color: s.color }}
            >
                <i className={`fa-solid ${s.icon} me-2`}></i>
                {message}
                <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
            </div>
        </div>
    );
}

export default function FlashMessage({ success, error, info }: FlashMessageProps) {
    const [visible, setVisible] = useState({ success: !!success, error: !!error, info: !!info });

    useEffect(() => {
        setVisible({ success: !!success, error: !!error, info: !!info });
        const timer = setTimeout(() => {
            setVisible({ success: false, error: false, info: false });
        }, 6000);
        return () => clearTimeout(timer);
    }, [success, error, info]);

    return (
        <>
            {success && visible.success && (
                <Alert kind="success" message={success} onClose={() => setVisible((v) => ({ ...v, success: false }))} />
            )}
            {error && visible.error && (
                <Alert kind="error" message={error} onClose={() => setVisible((v) => ({ ...v, error: false }))} />
            )}
            {info && visible.info && <Alert kind="info" message={info} onClose={() => setVisible((v) => ({ ...v, info: false }))} />}
        </>
    );
}
