import moment from 'moment';
import type { IPlatformConfig, PeakWindow } from '@/models/PlatformConfig';
import type { OrderPricing } from '@/models/Order';

export function isPeakHour(peakWindows: PeakWindow[] | undefined, at: Date = new Date()): boolean {
    const hour = moment(at).hour();
    return (peakWindows || []).some((w) => hour >= w.startHour && hour < w.endHour);
}

interface PricingInput {
    distanceKm: number;
    itemsValue?: number;
    at?: Date;
}

// C_logistics = Base Fee + (Distance km * Per-KM Rate) + Peak Surcharge
// V_total     = V_items + C_logistics
// Rider payout = C_logistics - Platform Fee (platformCommissionRate * C_logistics)
export function computePricing(config: IPlatformConfig, input: PricingInput): OrderPricing {
    const { distanceKm, itemsValue = 0, at = new Date() } = input;

    const baseFee = config.baseFee;
    const perKmRate = config.perKmRate;
    const distanceCost = Math.round(distanceKm * perKmRate * 100) / 100;
    const peakSurcharge = isPeakHour(config.peakWindows, at) ? config.peakSurcharge : 0;

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
