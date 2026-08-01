'use client';

import { useState, useRef } from 'react';

interface SimulateGpsButtonProps {
    orderId: string;
    from: { lat: number; lng: number };
    to: { lat: number; lng: number };
    label: string;
}

export default function SimulateGpsButton({ orderId, from, to, label }: SimulateGpsButtonProps) {
    const [progress, setProgress] = useState(0);
    const [running, setRunning] = useState(false);
    const stepsRef = useRef(0);

    function start() {
        if (running) return;
        setRunning(true);
        stepsRef.current = 0;
        const totalSteps = 40;

        const interval = setInterval(() => {
            stepsRef.current += 1;
            const t = Math.min(stepsRef.current / totalSteps, 1);
            const lat = from.lat + (to.lat - from.lat) * t;
            const lng = from.lng + (to.lng - from.lng) * t;

            fetch(`/api/rider/orders/${orderId}/location`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat, lng })
            }).catch(() => {});

            setProgress(Math.round(t * 100));

            if (t >= 1) {
                clearInterval(interval);
            }
        }, 4000);
    }

    return (
        <div className="mt-3">
            <button className="btn btn-outline-peach btn-sm" onClick={start} disabled={running}>
                <i className="fa-solid fa-location-crosshairs me-1"></i>Simulate GPS movement to {label}
            </button>
            <div className="progress mt-2" style={{ height: 6 }}>
                <div className="progress-bar" style={{ width: `${progress}%`, background: 'var(--thm-gradient)' }} />
            </div>
        </div>
    );
}
