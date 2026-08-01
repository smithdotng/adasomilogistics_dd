'use server';

import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/db';
import { requireRole, getSession } from '@/lib/session';
import { User } from '@/models/User';
import { RiderListing } from '@/models/RiderListing';
import { Order } from '@/models/Order';
import * as orderService from '@/lib/orderService';

function err(path: string, message: string): never {
    redirect(`${path}?error=${encodeURIComponent(message)}`);
}
function ok(path: string, message: string): never {
    redirect(`${path}?success=${encodeURIComponent(message)}`);
}

export async function toggleAvailabilityAction(): Promise<void> {
    const authUser = await requireRole('rider');
    await connectDB();

    const rider = await User.findById(authUser.id);
    if (!rider || !rider.riderInfo) err('/rider/dashboard', 'Rider profile not found.');

    rider.riderInfo.isAvailable = !rider.riderInfo.isAvailable;
    await rider.save();

    const session = await getSession();
    if (session.user) {
        session.user.riderInfo = {
            licenseNumber: rider.riderInfo.licenseNumber,
            vehicleType: rider.riderInfo.vehicleType,
            vehiclePlate: rider.riderInfo.vehiclePlate,
            kycStatus: rider.riderInfo.kycStatus,
            isAvailable: rider.riderInfo.isAvailable
        };
        await session.save();
    }

    ok('/rider/dashboard', `You are now ${rider.riderInfo.isAvailable ? 'available' : 'unavailable'} for dispatch.`);
}

export async function requestListingAction(formData: FormData): Promise<void> {
    const user = await requireRole('rider');
    await connectDB();
    const merchantId = String(formData.get('merchantId') || '');

    try {
        await RiderListing.findOneAndUpdate(
            { rider: user.id, merchant: merchantId },
            { $setOnInsert: { rider: user.id, merchant: merchantId, status: 'pending' } },
            { upsert: true, new: true }
        );
        ok('/rider/verification', 'Verification request sent to operator.');
    } catch (e) {
        err('/rider/verification', `Could not send request: ${(e as Error).message}`);
    }
}

export async function acceptOrderAction(formData: FormData): Promise<void> {
    const user = await requireRole('rider');
    await connectDB();
    const orderId = String(formData.get('orderId') || '');

    try {
        const order = await Order.findOne({
            _id: orderId,
            status: 'awaiting_assignment',
            assignedRider: { $exists: false },
            eligibleRiders: user.id
        });
        if (!order) err('/rider/orders', 'This delivery is no longer available.');

        order.assignedRider = user.id as unknown as typeof order.assignedRider;
        order.status = 'assigned';
        order.timeline.push({ status: 'assigned', note: 'Accepted by rider (first-come, first-served).', at: new Date() });
        await order.save();
        ok(`/rider/orders/${order._id}`, 'Delivery accepted. Head to pickup.');
    } catch (e) {
        err('/rider/orders', `Could not accept order: ${(e as Error).message}`);
    }
}

export async function verifyPickupAction(formData: FormData): Promise<void> {
    const user = await requireRole('rider');
    await connectDB();
    const orderId = String(formData.get('orderId') || '');
    const code = String(formData.get('code') || '');

    const order = await Order.findOne({ _id: orderId, assignedRider: user.id });
    if (!order) err('/rider/orders', 'Order not found.');

    try {
        await orderService.verifyPickupOtp(order, code);
        ok(`/rider/orders/${orderId}`, 'Pickup confirmed. En route to drop-off.');
    } catch (e) {
        err(`/rider/orders/${orderId}`, (e as Error).message);
    }
}

export async function verifyDeliveryAction(formData: FormData): Promise<void> {
    const user = await requireRole('rider');
    await connectDB();
    const orderId = String(formData.get('orderId') || '');
    const pin = String(formData.get('pin') || '');

    const order = await Order.findOne({ _id: orderId, assignedRider: user.id });
    if (!order) err('/rider/orders', 'Order not found.');

    try {
        await orderService.verifyDeliveryPin(order, pin);
        ok(`/rider/orders/${orderId}`, `Delivery completed. ₦${order.pricing.riderPayout.toLocaleString()} credited to your wallet.`);
    } catch (e) {
        err(`/rider/orders/${orderId}`, (e as Error).message);
    }
}
