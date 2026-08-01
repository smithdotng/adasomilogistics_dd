import RetryButton from './RetryButton';

export const metadata = {
    title: 'You’re offline'
};

export default function OfflinePage() {
    return (
        <main
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '32px',
                background: '#f5f9ff',
                color: '#1c2b3a'
            }}
        >
            <img src="/images/logo.png" alt="Adasomi Logistics" style={{ height: 48, marginBottom: 24 }} />
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>You&apos;re offline</h1>
            <p style={{ color: '#64748b', maxWidth: 360 }}>
                Adasomi needs an internet connection for live tracking, orders and wallet data. Reconnect and try
                again.
            </p>
            <RetryButton />
        </main>
    );
}
