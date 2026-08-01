'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { PeakWindow } from '@/models/PlatformConfig';

export interface PricingConfigInput {
    baseFee: number;
    perKmRate: number;
    peakSurcharge: number;
    peakWindows: PeakWindow[];
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isPeakNow(peakWindows: PeakWindow[]) {
    const hour = new Date().getHours();
    return (peakWindows || []).some((w) => hour >= w.startHour && hour < w.endHour);
}

interface OrderMapProps {
    config: PricingConfigInput;
    itemsValue?: number;
    showItemsValueInBreakdown?: boolean;
}

export default function OrderMap({ config, itemsValue = 0, showItemsValueInBreakdown = false }: OrderMapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const pickupMarkerRef = useRef<L.Marker | null>(null);
    const dropoffMarkerRef = useRef<L.Marker | null>(null);
    const stageRef = useRef<'pickup' | 'dropoff'>('pickup');

    const [pickup, setPickup] = useState<{ lat: number; lng: number } | null>(null);
    const [dropoff, setDropoff] = useState<{ lat: number; lng: number } | null>(null);
    const [pickupAddress, setPickupAddress] = useState('');
    const [dropoffAddress, setDropoffAddress] = useState('');
    const [instruction, setInstruction] = useState('Click the map to set the pickup point, then click again for the drop-off point.');

    useEffect(() => {
        let cancelled = false;

        import('leaflet').then((L) => {
            if (cancelled || !mapContainerRef.current || mapRef.current) return;

            const map = L.map(mapContainerRef.current).setView([6.5244, 3.3792], 12); // default: Lagos
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            map.on('click', (e: L.LeafletMouseEvent) => {
                const { lat, lng } = e.latlng;
                if (stageRef.current === 'pickup') {
                    if (pickupMarkerRef.current) map.removeLayer(pickupMarkerRef.current);
                    pickupMarkerRef.current = L.marker([lat, lng]).addTo(map).bindPopup('Pickup point').openPopup();
                    setPickup({ lat, lng });
                    stageRef.current = 'dropoff';
                    setInstruction('Now click the map to set the drop-off point.');
                } else {
                    if (dropoffMarkerRef.current) map.removeLayer(dropoffMarkerRef.current);
                    dropoffMarkerRef.current = L.marker([lat, lng]).addTo(map).bindPopup('Drop-off point').openPopup();
                    setDropoff({ lat, lng });
                    stageRef.current = 'pickup';
                    setInstruction('Click the map again to move pickup, or adjust the pins as needed.');
                }
            });

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

    const distanceKm = pickup && dropoff ? Math.round(haversineKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng) * 100) / 100 : null;

    let pricing: null | {
        distanceCost: number;
        peakSurcharge: number;
        logisticsCost: number;
        totalValue: number;
    } = null;

    if (distanceKm !== null) {
        const distanceCost = Math.round(distanceKm * config.perKmRate * 100) / 100;
        const peakSurcharge = isPeakNow(config.peakWindows) ? config.peakSurcharge : 0;
        const logisticsCost = Math.round((config.baseFee + distanceCost + peakSurcharge) * 100) / 100;
        const totalValue = Math.round((itemsValue + logisticsCost) * 100) / 100;
        pricing = { distanceCost, peakSurcharge, logisticsCost, totalValue };
    }

    return (
        <div>
            <p className="text-muted small">{instruction}</p>
            <div ref={mapContainerRef} className="tracking-map mb-3" />

            <div className="row g-3">
                <div className="col-md-6">
                    <label className="form-label">Pickup Address</label>
                    <input
                        type="text"
                        className="form-control"
                        name="pickupAddress"
                        required
                        placeholder="e.g. 12 Allen Avenue, Ikeja"
                        value={pickupAddress}
                        onChange={(e) => setPickupAddress(e.target.value)}
                    />
                    <input type="hidden" name="pickupLat" value={pickup?.lat ?? ''} required />
                    <input type="hidden" name="pickupLng" value={pickup?.lng ?? ''} required />
                </div>
                <div className="col-md-6">
                    <label className="form-label">Drop-off Address</label>
                    <input
                        type="text"
                        className="form-control"
                        name="dropoffAddress"
                        required
                        placeholder="e.g. 4 Admiralty Way, Lekki"
                        value={dropoffAddress}
                        onChange={(e) => setDropoffAddress(e.target.value)}
                    />
                    <input type="hidden" name="dropoffLat" value={dropoff?.lat ?? ''} required />
                    <input type="hidden" name="dropoffLng" value={dropoff?.lng ?? ''} required />
                </div>
            </div>

            <div className="mt-3 text-muted small">
                Distance: <strong>{distanceKm !== null ? `${distanceKm} km` : '—'}</strong>
            </div>

            {pricing && (
                <div className="pricing-box mt-3">
                    <div className="row-line">
                        <span>Base Fee</span>
                        <span>₦{config.baseFee.toLocaleString()}</span>
                    </div>
                    <div className="row-line">
                        <span>Distance Cost</span>
                        <span>
                            ₦{pricing.distanceCost.toLocaleString()} ({distanceKm} km × ₦{config.perKmRate})
                        </span>
                    </div>
                    <div className="row-line">
                        <span>Peak Surcharge</span>
                        <span>
                            ₦{pricing.peakSurcharge.toLocaleString()}
                            {pricing.peakSurcharge ? ' (peak hours)' : ''}
                        </span>
                    </div>
                    {showItemsValueInBreakdown && (
                        <div className="row-line">
                            <span>Item Value</span>
                            <span>₦{itemsValue.toLocaleString()}</span>
                        </div>
                    )}
                    <div className="row-line total">
                        <span>{showItemsValueInBreakdown ? 'Total (V_total)' : 'Total to Pay'}</span>
                        <span>₦{pricing.totalValue.toLocaleString()}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
