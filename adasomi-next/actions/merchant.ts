'use server';

import { redirect, unstable_rethrow } from 'next/navigation';
import { connectDB } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { User } from '@/models/User';
import { RiderListing } from '@/models/RiderListing';
import { Order } from '@/models/Order';
import { Dispute } from '@/models/Dispute';
import { PlatformConfig } from '@/models/PlatformConfig';
import { haversineDistanceKm } from '@/lib/geo';
import { computePricing } from '@/lib/pricing';
import { generateOrderNumber } from '@/lib/codes';
import * as orderService from '@/lib/orderService';

function err(path: string, message: string): never {
    redirect(`${path}?error=${encodeURIComponent(message)}`);
}
function ok(path: string, message: string): never {
    redirect(`${path}?success=${encodeURIComponent(message)}`);
}

export async function inviteRiderAction(formData: FormData): Promise<void> {
    const user = await requireRole('merchant');
    await connectDB();
    const riderId = String(formData.get('riderId') || '');

    try {
        await RiderListing.findOneAndUpdate(
            { rider: riderId, merchant: user.id },
            { $setOnInsert: { rider: riderId, merchant: user.id, status: 'approved', decidedAt: new Date() } },
            { upsert: true, new: true }
        );
        ok('/merchant/riders', 'Rider added to your fleet.');
    } catch (e) {
        unstable_rethrow(e);
        err('/merchant/riders', `Could not add rider: ${(e as Error).message}`);
    }
}

export async function decideRiderRequestAction(formData: FormData): Promise<void> {
    const user = await requireRole('merchant');
    await connectDB();
    const listingId = String(formData.get('listingId') || '');
    const decision = String(formData.get('decision') || '');

    const listing = await RiderListing.findOne({ _id: listingId, merchant: user.id });
    if (!listing) err('/merchant/riders', 'Listing not found.');

    listing.status = decision === 'approve' ? 'approved' : 'rejected';
    listing.decidedAt = new Date();
    await listing.save();
    ok('/merchant/riders', `Rider request ${listing.status}.`);
}

export async function createOrderAction(formData: FormData): Promise<void> {
    const user = await requireRole('merchant');
    await connectDB();

    try {
        const recipientName = String(formData.get('recipientName') || '');
        const recipientPhone = String(formData.get('recipientPhone') || '');
        const pickupAddress = String(formData.get('pickupAddress') || '');
        const pickupLat = parseFloat(String(formData.get('pickupLat') || ''));
        const pickupLng = parseFloat(String(formData.get('pickupLng') || ''));
        const dropoffAddress = String(formData.get('dropoffAddress') || '');
        const dropoffLat = parseFloat(String(formData.get('dropoffLat') || ''));
        const dropoffLng = parseFloat(String(formData.get('dropoffLng') || ''));
        const itemsDescription = String(formData.get('itemsDescription') || '');
        const itemsValue = parseFloat(String(formData.get('itemsValue') || '0')) || 0;
        const dispatchMode = String(formData.get('dispatchMode') || 'broadcast') as 'manual' | 'broadcast';
        const assignedRiderId = String(formData.get('assignedRiderId') || '');

        const config = await PlatformConfig.getSingleton();
        const distanceKm = haversineDistanceKm(pickupLat, pickupLng, dropoffLat, dropoffLng);
        const pricing = computePricing(config, { distanceKm, itemsValue });

        let eligibleRiders: unknown[] = [];
        if (dispatchMode === 'broadcast') {
            const listings = await RiderListing.find({ merchant: user.id, status: 'approved' });
            eligibleRiders = listings.map((l) => l.rider);
        }

        const order = await Order.create({
            orderNumber: generateOrderNumber(),
            type: 'merchant',
            merchant: user.id,
            recipientName,
            recipientPhone,
            pickupAddress,
            pickupLat,
            pickupLng,
            dropoffAddress,
            dropoffLat,
            dropoffLng,
            distanceKm,
            itemsDescription,
            itemsValue,
            pricing,
            dispatchMode,
            assignedRider: dispatchMode === 'manual' ? assignedRiderId : undefined,
            eligibleRiders,
            timeline: [{ status: 'awaiting_payment', note: 'Order created, awaiting escrow funding.', at: new Date() }]
        });

        redirect(`/merchant/orders/${order._id}`);
    } catch (e) {
        unstable_rethrow(e);
        err('/merchant/orders/new', `Could not create order: ${(e as Error).message}`);
    }
}

export async function fundEscrowAction(formData: FormData): Promise<void> {
    const user = await requireRole('merchant');
    await connectDB();
    const orderId = String(formData.get('orderId') || '');

    const order = await Order.findOne({ _id: orderId, merchant: user.id });
    if (!order) err('/merchant/orders', 'Order not found.');

    try {
        await orderService.fundEscrow(order);
        if (order.dispatchMode === 'manual' && order.assignedRider) {
            order.status = 'assigned';
            order.timeline.push({ status: 'assigned', note: 'Manually assigned to selected rider.', at: new Date() });
            await order.save();
        }
        ok(`/merchant/orders/${order._id}`, `Escrow funded (₦${order.pricing.totalValue.toLocaleString()}). Dispatch is now live.`);
    } catch (e) {
        unstable_rethrow(e);
        err('/merchant/orders', `Could not fund escrow: ${(e as Error).message}`);
    }
}

export async function cancelOrderAction(formData: FormData): Promise<void> {
    const user = await requireRole('merchant');
    await connectDB();
    const orderId = String(formData.get('orderId') || '');

    const order = await Order.findOne({ _id: orderId, merchant: user.id });
    if (!order) err('/merchant/orders', 'Order not found.');

    if (['picked_up', 'delivered', 'completed'].includes(order.status)) {
        err(`/merchant/orders/${order._id}`, 'Cannot cancel an order already in transit or completed.');
    }

    order.status = 'cancelled';
    if (order.escrow.status === 'held') order.escrow.status = 'refunded';
    order.timeline.push({ status: 'cancelled', note: 'Order cancelled by merchant.', at: new Date() });
    await order.save();
    ok('/merchant/orders', 'Order cancelled.');
}

export async function raiseDisputeAction(formData: FormData): Promise<void> {
    const user = await requireRole('merchant');
    await connectDB();
    const orderId = String(formData.get('orderId') || '');
    const reason = String(formData.get('reason') || '');

    const order = await Order.findOne({ _id: orderId, merchant: user.id });
    if (!order) err('/merchant/orders', 'Order not found.');

    try {
        await Dispute.create({ order: order._id, raisedBy: user.id, reason });
        order.status = 'disputed';
        order.timeline.push({ status: 'disputed', note: 'Dispute raised by merchant.', at: new Date() });
        await order.save();
        ok(`/merchant/orders/${orderId}`, 'Dispute submitted to Adasomi support.');
    } catch (e) {
        unstable_rethrow(e);
        err(`/merchant/orders/${orderId}`, `Could not raise dispute: ${(e as Error).message}`);
    }
}

// Referenced by User import above to satisfy the "search riders" query in the
// riders page (kept here so the Server Component page can just call this
// helper directly rather than duplicating the query shape).
export async function searchRidersData(q: string) {
    await connectDB();
    if (!q) return [];
    return User.find({
        role: 'rider',
        $or: [{ email: new RegExp(q, 'i') }, { firstName: new RegExp(q, 'i') }, { lastName: new RegExp(q, 'i') }]
    })
        .limit(20)
        .lean();
}
