const moment = require('moment');

// C_logistics = Base Fee + (Distance km * Per-KM Rate) + Peak Surcharge
// V_total     = V_items + C_logistics
// Rider payout = C_logistics - Platform Fee (platformCommissionRate * C_logistics)
function isPeakHour(config, date = new Date()) {
    const hour = moment(date).hour();
    return (config.peakWindows || []).some(w => hour >= w.startHour && hour < w.endHour);
}

function computePricing(config, { distanceKm, itemsValue = 0, at = new Date() }) {
    const baseFee = config.baseFee;
    const perKmRate = config.perKmRate;
    const distanceCost = Math.round(distanceKm * perKmRate * 100) / 100;
    const peakSurcharge = isPeakHour(config, at) ? config.peakSurcharge : 0;

    const logisticsCost = Math.round((baseFee + distanceCost + peakSurcharge) * 100) / 100;
    const platformFeeRate = config.platformCommissionRate;
    const platformFee = Math.round(logisticsCost * platformFeeRate * 100) / 100;
    const riderPayout = Math.round((logisticsCost - platformFee) * 100) / 100;
    const totalValue = Math.round((Number(itemsValue) + logisticsCost) * 100) / 100;

    return {
        baseFee,
        perKmRate,
        distanceCost,
        peakSurcharge,
        logisticsCost,
        platformFeeRate,
        platformFee,
        riderPayout,
        totalValue
    };
}

module.exports = { computePricing, isPeakHour };
