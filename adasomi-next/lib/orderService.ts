import { generateNumericCode } from '@/lib/codes';
import * as walletService from '@/lib/walletService';
import type { IOrder } from '@/models/Order';

// Escrow: customer pays V_total up front, held by the platform until the
// delivery PIN is confirmed by the recipient.
export async function fundEscrow(order: IOrder): Promise<IOrder> {
    order.escrow.status = 'held';
    order.escrow.amountHeld = order.pricing.totalValue;
    order.escrow.fundedAt = new Date();
    order.status = 'awaiting_assignment';
    order.otp.pickupCode = generateNumericCode(4);
    order.otp.deliveryPin = generateNumericCode(4);
    order.timeline.push({ status: 'awaiting_assignment', note: 'Escrow funded. Awaiting rider assignment.', at: new Date() });
    await order.save();
    return order;
}

export async function verifyPickupOtp(order: IOrder, code: string): Promise<IOrder> {
    if (order.otp.pickupCode !== code) {
        throw new Error('Incorrect pickup OTP.');
    }
    order.otp.pickupVerifiedAt = new Date();
    order.status = 'picked_up';
    order.timeline.push({ status: 'picked_up', note: 'Pickup OTP verified by sender.', at: new Date() });
    await order.save();
    return order;
}

// Delivery PIN confirms completion -> releases escrow with the automated split:
//   V_items released to merchant (merchant orders only)
//   C_logistics - platformFee credited to rider
//   platformFee credited to the platform wallet
export async function verifyDeliveryPin(order: IOrder, pin: string): Promise<IOrder> {
    if (order.otp.deliveryPin !== pin) {
        throw new Error('Incorrect delivery PIN.');
    }
    order.otp.deliveryVerifiedAt = new Date();
    order.status = 'delivered';
    order.timeline.push({ status: 'delivered', note: 'Delivery PIN verified by recipient.', at: new Date() });
    await settlePayout(order);
    order.status = 'completed';
    order.escrow.status = 'released';
    order.escrow.releasedAt = new Date();
    order.timeline.push({ status: 'completed', note: 'Escrow released. Payouts settled.', at: new Date() });
    await order.save();
    return order;
}

export async function settlePayout(order: IOrder): Promise<void> {
    const { itemsValue, pricing } = order;

    if (order.type === 'merchant' && order.merchant && itemsValue > 0) {
        const merchantWallet = await walletService.getOrCreateWallet(order.merchant, 'merchant');
        await walletService.credit(merchantWallet, itemsValue, 'payout_items', order, `Order ${order.orderNumber}: item value payout`);
    }

    if (order.assignedRider) {
        const riderWallet = await walletService.getOrCreateWallet(order.assignedRider, 'rider');
        await walletService.credit(riderWallet, pricing.riderPayout, 'payout_logistics', order, `Order ${order.orderNumber}: logistics fee payout`);
    }

    const platformWallet = await walletService.getPlatformWallet();
    await walletService.credit(platformWallet, pricing.platformFee, 'platform_fee', order, `Order ${order.orderNumber}: platform commission`);
}
