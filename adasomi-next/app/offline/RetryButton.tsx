'use client';

export default function RetryButton() {
    return (
        <button
            onClick={() => window.location.reload()}
            style={{
                marginTop: 24,
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                background: '#2f7dd8',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer'
            }}
        >
            Retry
        </button>
    );
}
