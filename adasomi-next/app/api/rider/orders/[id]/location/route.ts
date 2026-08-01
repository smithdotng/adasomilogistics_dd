import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { Order } from '@/models/Order';
import { User } from '@/models/User';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user || user.role !== 'rider') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const lat = parseFloat(body.lat);
        const lng = parseFloat(body.lng);

        await connectDB();
        const order = await Order.findOne({ _id: id, assignedRider: user.id });
        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

        order.tracking.push({ lat, lng, at: new Date() });
        if (order.tracking.length > 200) order.tracking.shift();
        await order.save();

        await User.findByIdAndUpdate(user.id, {
            'riderInfo.currentLat': lat,
            'riderInfo.currentLng': lng
        });

        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
