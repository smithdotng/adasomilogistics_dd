import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { Order } from '@/models/Order';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const order = await Order.findById(id).populate('assignedRider', 'firstName lastName phone riderInfo');
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const assignedRider = order.assignedRider as unknown as {
        _id: { toString(): string };
        firstName: string;
        lastName: string;
        phone: string;
        riderInfo?: { vehicleType?: string };
    } | null;

    const isMerchantOwner = order.merchant && order.merchant.toString() === user.id;
    const isCustomerOwner = order.customer && order.customer.toString() === user.id;
    const isAssignedRider = assignedRider && assignedRider._id.toString() === user.id;
    const isAdmin = user.role === 'admin';

    if (!isMerchantOwner && !isCustomerOwner && !isAssignedRider && !isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const lastPoint = order.tracking.length ? order.tracking[order.tracking.length - 1] : null;

    return NextResponse.json({
        status: order.status,
        escrowStatus: order.escrow.status,
        currentLocation: lastPoint ? { lat: lastPoint.lat, lng: lastPoint.lng, at: lastPoint.at } : null,
        trackingHistory: order.tracking,
        assignedRider: assignedRider
            ? {
                  name: `${assignedRider.firstName} ${assignedRider.lastName}`,
                  phone: assignedRider.phone,
                  vehicleType: assignedRider.riderInfo?.vehicleType || null
              }
            : null,
        timeline: order.timeline
    });
}
