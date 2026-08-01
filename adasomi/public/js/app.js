// Adasomi client-side helpers: auto-hide flash alerts, pick-on-map order
// forms, live pricing preview, and live delivery tracking polling.

document.addEventListener('DOMContentLoaded', function () {
    // Auto-hide flash alerts
    document.querySelectorAll('.alert-auto-hide').forEach(function (alert) {
        setTimeout(function () {
            alert.style.transition = 'opacity 0.5s ease';
            alert.style.opacity = '0';
            setTimeout(function () { alert.remove(); }, 500);
        }, 6000);
    });

    initOrderMap();
    initTrackingMap();
});

function haversineKm(lat1, lng1, lat2, lng2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isPeakNow(peakWindows) {
    const hour = new Date().getHours();
    return (peakWindows || []).some(w => hour >= w.startHour && hour < w.endHour);
}

function recomputePricing() {
    const mapEl = document.getElementById('order-map');
    if (!mapEl) return;
    const config = JSON.parse(mapEl.dataset.config || '{}');
    const pickupLat = parseFloat(document.getElementById('pickupLat').value);
    const pickupLng = parseFloat(document.getElementById('pickupLng').value);
    const dropoffLat = parseFloat(document.getElementById('dropoffLat').value);
    const dropoffLng = parseFloat(document.getElementById('dropoffLng').value);
    const itemsValueEl = document.getElementById('itemsValue');
    const itemsValue = itemsValueEl ? (parseFloat(itemsValueEl.value) || 0) : 0;

    const distanceEl = document.getElementById('distancePreview');
    const pricingEl = document.getElementById('pricingPreview');

    if (isNaN(pickupLat) || isNaN(pickupLng) || isNaN(dropoffLat) || isNaN(dropoffLng)) {
        if (distanceEl) distanceEl.textContent = '—';
        if (pricingEl) pricingEl.classList.add('d-none');
        return;
    }

    const distanceKm = Math.round(haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng) * 100) / 100;
    const baseFee = config.baseFee;
    const perKmRate = config.perKmRate;
    const distanceCost = Math.round(distanceKm * perKmRate * 100) / 100;
    const peakSurcharge = isPeakNow(config.peakWindows) ? config.peakSurcharge : 0;
    const logisticsCost = Math.round((baseFee + distanceCost + peakSurcharge) * 100) / 100;
    const totalValue = Math.round((itemsValue + logisticsCost) * 100) / 100;

    if (distanceEl) distanceEl.textContent = distanceKm + ' km';
    if (pricingEl) {
        pricingEl.classList.remove('d-none');
        const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        setText('pv-baseFee', '₦' + baseFee.toLocaleString());
        setText('pv-distanceCost', '₦' + distanceCost.toLocaleString() + ' (' + distanceKm + ' km × ₦' + perKmRate + ')');
        setText('pv-peakSurcharge', '₦' + peakSurcharge.toLocaleString() + (peakSurcharge ? ' (peak hours)' : ''));
        setText('pv-logisticsCost', '₦' + logisticsCost.toLocaleString());
        setText('pv-itemsValue', '₦' + itemsValue.toLocaleString());
        setText('pv-total', '₦' + totalValue.toLocaleString());
    }
}

function initOrderMap() {
    const mapEl = document.getElementById('order-map');
    if (!mapEl || typeof L === 'undefined') return;

    const map = L.map('order-map').setView([6.5244, 3.3792], 12); // default: Lagos
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    let pickupMarker = null;
    let dropoffMarker = null;
    let stage = 'pickup';

    const statusEl = document.getElementById('map-instruction');

    map.on('click', function (e) {
        const { lat, lng } = e.latlng;
        if (stage === 'pickup') {
            if (pickupMarker) map.removeLayer(pickupMarker);
            pickupMarker = L.marker([lat, lng], { title: 'Pickup' }).addTo(map).bindPopup('Pickup point').openPopup();
            document.getElementById('pickupLat').value = lat.toFixed(6);
            document.getElementById('pickupLng').value = lng.toFixed(6);
            stage = 'dropoff';
            if (statusEl) statusEl.textContent = 'Now click the map to set the drop-off point.';
        } else {
            if (dropoffMarker) map.removeLayer(dropoffMarker);
            dropoffMarker = L.marker([lat, lng], { title: 'Drop-off' }).addTo(map).bindPopup('Drop-off point').openPopup();
            document.getElementById('dropoffLat').value = lat.toFixed(6);
            document.getElementById('dropoffLng').value = lng.toFixed(6);
            stage = 'pickup';
            if (statusEl) statusEl.textContent = 'Click the map again to move pickup, or drop-off is set — adjust values below if needed.';
        }
        recomputePricing();
    });

    ['pickupLat', 'pickupLng', 'dropoffLat', 'dropoffLng', 'itemsValue'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', recomputePricing);
    });

    recomputePricing();
}

function initTrackingMap() {
    const mapEl = document.getElementById('tracking-map');
    if (!mapEl || typeof L === 'undefined') return;

    const orderId = mapEl.dataset.orderId;
    const pickup = JSON.parse(mapEl.dataset.pickup);
    const dropoff = JSON.parse(mapEl.dataset.dropoff);

    const map = L.map('tracking-map').setView([pickup.lat, pickup.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const pickupIcon = L.divIcon({ className: 'thm-pin', html: '<div style="background:#2fa66a;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px #2fa66a;"></div>' });
    const dropoffIcon = L.divIcon({ className: 'thm-pin', html: '<div style="background:#e2544a;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px #e2544a;"></div>' });
    const riderIcon = L.divIcon({ className: 'thm-pin', html: '<div style="background:#2f7dd8;width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 8px rgba(47,125,216,0.8);"></div>' });

    L.marker([pickup.lat, pickup.lng], { icon: pickupIcon }).addTo(map).bindPopup('Pickup');
    L.marker([dropoff.lat, dropoff.lng], { icon: dropoffIcon }).addTo(map).bindPopup('Drop-off');
    map.fitBounds([[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]], { padding: [40, 40] });

    let riderMarker = null;

    function poll() {
        fetch('/api/orders/' + orderId + '/tracking')
            .then(r => r.json())
            .then(data => {
                const statusBadge = document.getElementById('live-status-badge');
                if (statusBadge && data.status) {
                    statusBadge.textContent = data.status.replace(/_/g, ' ');
                    statusBadge.className = 'badge-pill status-' + data.status;
                }
                if (data.currentLocation) {
                    const { lat, lng } = data.currentLocation;
                    if (!riderMarker) {
                        riderMarker = L.marker([lat, lng], { icon: riderIcon }).addTo(map).bindPopup('Rider location');
                    } else {
                        riderMarker.setLatLng([lat, lng]);
                    }
                }
            })
            .catch(() => {});
    }

    poll();
    setInterval(poll, 4000);
}

// Rider-side: simulate GPS by moving toward the drop-off point each tick,
// posting the new coordinates to the server every ~4 seconds.
function startRiderSimulation(orderId, fromLat, fromLng, toLat, toLng) {
    let progress = 0;
    const steps = 40;
    const interval = setInterval(() => {
        progress += 1;
        const t = Math.min(progress / steps, 1);
        const lat = fromLat + (toLat - fromLat) * t;
        const lng = fromLng + (toLng - fromLng) * t;
        fetch('/rider/orders/' + orderId + '/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng })
        }).catch(() => {});
        const el = document.getElementById('sim-progress');
        if (el) el.style.width = Math.round(t * 100) + '%';
        if (t >= 1) clearInterval(interval);
    }, 4000);
}
