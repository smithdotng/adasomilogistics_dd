'use server';

import { redirect, unstable_rethrow } from 'next/navigation';
import { connectDB } from '@/lib/db';
import { requireRole } from '@/lib/session';
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

async function getVerifiedRiderIds() {
    return RiderListing.find({ status: 'approved' }).distinct('rider');
}

export async function createCustomerOrderAction(formData: FormData): Promise<void> {
    const user = await requireRole('public_user');
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

        const config = await PlatformConfig.getSingleton();
        const distanceKm = haversineDistanceKm(pickupLat, pickupLng, dropoffLat, dropoffLng);
        const pricing = computePricing(config, { distanceKm, itemsValue: 0 });
        const eligibleRiders = await getVerifiedRiderIds();

        const order = await Order.create({
            orderNumber: generateOrderNumber(),
            type: 'public',
            customer: user.id,
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
            itemsValue: 0,
            pricing,
            dispatchMode: 'broadcast',
            eligibleRiders,
            timeline: [{ status: 'awaiting_payment', note: 'Request created, awaiting payment.', at: new Date() }]
        });

        redirect(`/customer/orders/${order._id}`);
    } catch (e) {
        unstable_rethrow(e);
        err('/customer/orders/new', `Could not create request: ${(e as Error).message}`);
    }
}

export async function customerFundEscrowAction(formData: FormData): Promise<void> {
    const user = await requireRole('public_user');
    await connectDB();
    const orderId = String(formData.get('orderId') || '');

    const order = await Order.findOne({ _id: orderId, customer: user.id });
    if (!order) err('/customer/dashboard', 'Request not found.');

    try {
        await orderService.fundEscrow(order);
        ok(`/customer/orders/${order._id}`, `Payment of ₦${order.pricing.totalValue.toLocaleString()} confirmed. Searching for a nearby rider.`);
    } catch (e) {
        unstable_rethrow(e);
        err('/customer/dashboard', `Could not confirm payment: ${(e as Error).message}`);
    }
}

export async function customerCancelOrderAction(formData: FormData): Promise<void> {
    const user = await requireRole('public_user');
    await connectDB();
    const orderId = String(formData.get('orderId') || '');

    const order = await Order.findOne({ _id: orderId, customer: user.id });
    if (!order) err('/customer/dashboard', 'Request not found.');

    if (['picked_up', 'delivered', 'completed'].includes(order.status)) {
        err(`/customer/orders/${order._id}`, 'Cannot cancel a request already in transit or completed.');
    }

    order.status = 'cancelled';
    if (order.escrow.status === 'held') order.escrow.status = 'refunded';
    order.timeline.push({ status: 'cancelled', note: 'Request cancelled by customer.', at: new Date() });
    await order.save();
    ok('/customer/dashboard', 'Request cancelled.');
}

export async function customerRaiseDisputeAction(formData: FormData): Promise<void> {
    const user = await requireRole('public_user');
    await connectDB();
    const orderId = String(formData.get('orderId') || '');
    const reason = String(formData.get('reason') || '');

    const order = await Order.findOne({ _id: orderId, customer: user.id });
    if (!order) err('/customer/dashboard', 'Request not found.');

    try {
        await Dispute.create({ order: order._id, raisedBy: user.id, reason });
        order.status = 'disputed';
        order.timeline.push({ status: 'disputed', note: 'Dispute raised by customer.', at: new Date() });
        await order.save();
        ok(`/customer/orders/${orderId}`, 'Dispute submitted to Adasomi support.');
    } catch (e) {
        unstable_rethrow(e);
        err(`/customer/orders/${orderId}`, `Could not raise dispute: ${(e as Error).message}`);
    }
}
