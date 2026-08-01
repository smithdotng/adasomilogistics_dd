import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { Order } from '@/models/Order';
import FlashMessage from '@/components/FlashMessage';
import TrackingMap from '@/components/TrackingMap';
import SimulateGpsButton from '@/components/SimulateGpsButton';
import { verifyPickupAction, verifyDeliveryAction } from '@/actions/rider';

export const metadata = { title: 'Delivery Detail' };

export default async function RiderOrderDetailPage({
    params,
    searchParams
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    const user = await requireRole('rider');
    const { id } = await params;
    const sp = await searchParams;
    await connectDB();

    const order = await Order.findOne({ _id: id, assignedRider: user.id }).populate('merchant').lean();
    if (!order) {
        redirect(`/rider/orders?error=${encodeURIComponent('Order not found.')}`);
    }

    const simFrom =
        order.status === 'assigned'
            ? { lat: order.pickupLat - 0.01, lng: order.pickupLng - 0.01 }
            : { lat: order.pickupLat, lng: order.pickupLng };
    const simTo =
        order.status === 'assigned'
            ? { lat: order.pickupLat, lng: order.pickupLng }
            : { lat: order.dropoffLat, lng: order.dropoffLng };

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={sp.success} error={sp.error} info={sp.info} />

                <p className="section-title mb-1">Delivery {order.orderNumber}</p>
                <h2 className="mb-4"><span className={`badge-pill status-${order.status}`}>{order.status.replace(/_/g, ' ')}</span></h2>

                <div className="row g-4">
                    <div className="col-lg-7">
                        <div className="card mb-4">
                            <div className="card-header">Route</div>
                            <div className="card-body">
                                <TrackingMap
                                    orderId={String(order._id)}
                                    pickup={{ lat: order.pickupLat, lng: order.pickupLng, address: order.pickupAddress }}
                                    dropoff={{ lat: order.dropoffLat, lng: order.dropoffLng, address: order.dropoffAddress }}
                                    initialStatus={order.status}
                                />
                                <div className="row mt-3 text-muted small">
                                    <div className="col-6"><i className="fa-solid fa-circle text-success me-1"></i>Pickup: {order.pickupAddress}</div>
                                    <div className="col-6"><i className="fa-solid fa-circle text-danger me-1"></i>Drop-off: {order.dropoffAddress}</div>
                                </div>

                                {(order.status === 'assigned' || order.status === 'picked_up') && (
                                    <SimulateGpsButton
                                        orderId={String(order._id)}
                                        from={simFrom}
                                        to={simTo}
                                        label={order.status === 'assigned' ? 'pickup' : 'drop-off'}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-5">
                        <div className="card mb-4">
                            <div className="card-header">Recipient</div>
                            <div className="card-body">
                                <p className="mb-1"><strong>Name:</strong> {order.recipientName}</p>
                                <p className="mb-1"><strong>Phone:</strong> {order.recipientPhone}</p>
                                <p className="mb-0"><strong>Items:</strong> {order.itemsDescription || '—'}</p>
                            </div>
                        </div>

                        {order.status === 'assigned' && (
                            <div className="card mb-4">
                                <div className="card-header">Confirm Pickup</div>
                                <div className="card-body">
                                    <p className="text-muted small">Ask the sender for the 4-digit pickup OTP.</p>
                                    <form action={verifyPickupAction} className="d-flex gap-2">
                                        <input type="hidden" name="orderId" value={String(order._id)} />
                                        <input type="text" className="form-control" name="code" maxLength={4} required placeholder="0000" />
                                        <button className="btn btn-peach">Verify</button>
                                    </form>
                                </div>
                            </div>
                        )}

                        {order.status === 'picked_up' && (
                            <div className="card mb-4">
                                <div className="card-header">Confirm Delivery</div>
                                <div className="card-body">
                                    <p className="text-muted small">Ask the recipient for the 4-digit delivery PIN. This releases your payout instantly.</p>
                                    <form action={verifyDeliveryAction} className="d-flex gap-2">
                                        <input type="hidden" name="orderId" value={String(order._id)} />
                                        <input type="text" className="form-control" name="pin" maxLength={4} required placeholder="0000" />
                                        <button className="btn btn-peach">Complete Delivery</button>
                                    </form>
                                </div>
                            </div>
                        )}

                        {order.status === 'completed' && (
                            <div className="card">
                                <div className="card-header">Payout</div>
                                <div className="card-body text-center">
                                    <div className="stat-value mb-1">₦{order.pricing.riderPayout.toLocaleString()}</div>
                                    <p className="text-muted small mb-0">Credited to your wallet</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
