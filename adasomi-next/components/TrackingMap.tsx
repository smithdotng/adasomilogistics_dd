'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

interface TrackingMapProps {
    orderId: string;
    pickup: { lat: number; lng: number; address: string };
    dropoff: { lat: number; lng: number; address: string };
    initialStatus: string;
    pollMs?: number;
}

interface TrackingResponse {
    status: string;
    escrowStatus?: string;
    currentLocation?: { lat: number; lng: number; at: string } | null;
}

export default function TrackingMap({ orderId, pickup, dropoff, initialStatus, pollMs = 5000 }: TrackingMapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const riderMarkerRef = useRef<L.Marker | null>(null);
    const [status, setStatus] = useState(initialStatus);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [riderPos, setRiderPos] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        let cancelled = false;

        import('leaflet').then((L) => {
            if (cancelled || !mapContainerRef.current || mapRef.current) return;

            const map = L.map(mapContainerRef.current).setView([pickup.lat, pickup.lng], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            const pickupIcon = L.divIcon({
                className: 'tracking-pin tracking-pin-pickup',
                html: '<i class="fa-solid fa-store"></i>',
                iconSize: [28, 28]
            });
            const dropoffIcon = L.divIcon({
                className: 'tracking-pin tracking-pin-dropoff',
                html: '<i class="fa-solid fa-flag-checkered"></i>',
                iconSize: [28, 28]
            });

            L.marker([pickup.lat, pickup.lng], { icon: pickupIcon }).addTo(map).bindPopup(`Pickup: ${pickup.address}`);
            L.marker([dropoff.lat, dropoff.lng], { icon: dropoffIcon }).addTo(map).bindPopup(`Drop-off: ${dropoff.address}`);

            const bounds = L.latLngBounds([
                [pickup.lat, pickup.lng],
                [dropoff.lat, dropoff.lng]
            ]);
            map.fitBounds(bounds, { padding: [40, 40] });

            mapRef.current = map;
        });

        return () => {
            cancelled = true;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        async function poll() {
            try {
                const res = await fetch(`/api/orders/${orderId}/tracking`, { cache: 'no-store' });
                if (res.ok) {
                    const data: TrackingResponse = await res.json();
                    if (!cancelled) {
                        setStatus(data.status);
                        if (data.currentLocation) {
                            setRiderPos({ lat: data.currentLocation.lat, lng: data.currentLocation.lng });
                            setLastUpdated(data.currentLocation.at);
                        }
                    }
                }
            } catch {
                // silently retry on next interval
            }
            if (!cancelled) {
                timer = setTimeout(poll, pollMs);
            }
        }

        poll();

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [orderId, pollMs]);

    useEffect(() => {
        let cancelled = false;
        import('leaflet').then((L) => {
            if (cancelled || !mapRef.current || !riderPos) return;
            const riderIcon = L.divIcon({
                className: 'tracking-pin tracking-pin-rider',
                html: '<i class="fa-solid fa-motorcycle"></i>',
                iconSize: [30, 30]
            });
            if (riderMarkerRef.current) {
                riderMarkerRef.current.setLatLng([riderPos.lat, riderPos.lng]);
            } else {
                riderMarkerRef.current = L.marker([riderPos.lat, riderPos.lng], { icon: riderIcon })
                    .addTo(mapRef.current!)
                    .bindPopup('Rider location');
            }
        });
        return () => {
            cancelled = true;
        };
    }, [riderPos]);

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <span className={`status-badge status-${status}`}>{status.replace(/_/g, ' ')}</span>
                {lastUpdated && (
                    <span className="text-muted small">Rider location updated {new Date(lastUpdated).toLocaleTimeString()}</span>
                )}
            </div>
            <div ref={mapContainerRef} className="tracking-map" />
        </div>
    );
}
