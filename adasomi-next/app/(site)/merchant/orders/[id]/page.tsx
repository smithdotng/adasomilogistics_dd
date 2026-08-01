import { redirect } from 'next/navigation';
import moment from 'moment';
import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { Order } from '@/models/Order';
import FlashMessage from '@/components/FlashMessage';
import TrackingMap from '@/components/TrackingMap';
import { fundEscrowAction, cancelOrderAction, raiseDisputeAction } from '@/actions/merchant';

export const metadata = { title: 'Order Detail' };

export default async function MerchantOrderDetailPage({
    params,
    searchParams
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    const user = await requireRole('merchant');
    const { id } = await params;
    const sp = await searchParams;
    await connectDB();

    const order = await Order.findOne({ _id: id, merchant: user.id })
        .populate('assignedRider')
        .populate('eligibleRiders')
        .lean();

    if (!order) {
        redirect(`/merchant/orders?error=${encodeURIComponent('Order not found.')}`);
    }

    const assignedRider = order.assignedRider as unknown as { firstName: string; lastName: string; phone: string } | null;

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={sp.success} error={sp.error} info={sp.info} />

                <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
                    <div>
                        <p className="section-title mb-1">Order {order.orderNumber}</p>
                        <h2 className="mb-0">
                            <span className={`badge-pill status-${order.status}`}>{order.status.replace(/_/g, ' ')}</span>
                        </h2>
                    </div>
                    <div className="d-flex gap-2">
                        {order.status === 'awaiting_payment' && (
                            <form action={fundEscrowAction}>
                                <input type="hidden" name="orderId" value={String(order._id)} />
                                <button className="btn btn-peach">
                                    <i className="fa-solid fa-lock me-2"></i>Fund Escrow (₦{order.pricing.totalValue.toLocaleString()})
                                </button>
                            </form>
                        )}
                        {['awaiting_payment', 'awaiting_assignment', 'assigned'].includes(order.status) && (
                            <form action={cancelOrderAction}>
                                <input type="hidden" name="orderId" value={String(order._id)} />
                                <button className="btn btn-danger-soft">Cancel Order</button>
                            </form>
                        )}
                    </div>
                </div>

                <div className="row g-4">
                    <div className="col-lg-7">
                        <div className="card mb-4">
                            <div className="card-header">Live Tracking</div>
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
                            </div>
                        </div>

                        <div className="card mb-4">
                            <div className="card-header">Timeline</div>
                            <div className="card-body">
                                <ul className="timeline">
                                    {[...order.timeline].reverse().map((t, idx) => (
                                        <li key={idx}>
                                            <strong>{t.status.replace(/_/g, ' ')}</strong>
                                            <div className="timeline-time">{moment(t.at).format('MMM D, h:mm:ss A')}</div>
                                            <div className="text-muted small">{t.note}</div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {!['completed', 'cancelled'].includes(order.status) && (
                            <div className="card">
                                <div className="card-header">Raise a Dispute</div>
                                <div className="card-body">
                                    <form action={raiseDisputeAction}>
                                        <input type="hidden" name="orderId" value={String(order._id)} />
                                        <textarea className="form-control mb-2" name="reason" rows={2} placeholder="Describe the issue…" required></textarea>
                                        <button className="btn btn-danger-soft" type="submit">Submit to Adasomi Support</button>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="col-lg-5">
                        <div className="card mb-4">
                            <div className="card-header">Pricing Breakdown</div>
                            <div className="card-body">
                                <div className="pricing-box">
                                    <div className="row-line"><span>Base Fee</span><span>₦{order.pricing.baseFee.toLocaleString()}</span></div>
                                    <div className="row-line"><span>Distance Cost ({order.distanceKm} km)</span><span>₦{order.pricing.distanceCost.toLocaleString()}</span></div>
                                    <div className="row-line"><span>Peak Surcharge</span><span>₦{order.pricing.peakSurcharge.toLocaleString()}</span></div>
                                    <div className="row-line"><span>Logistics Fee (C_logistics)</span><span>₦{order.pricing.logisticsCost.toLocaleString()}</span></div>
                                    <div className="row-line"><span>Item Value (V_items)</span><span>₦{order.itemsValue.toLocaleString()}</span></div>
                                    <div className="row-line"><span>Platform Fee</span><span>₦{order.pricing.platformFee.toLocaleString()}</span></div>
                                    <div className="row-line"><span>Rider Payout</span><span>₦{order.pricing.riderPayout.toLocaleString()}</span></div>
                                    <div className="row-line total"><span>Total (V_total)</span><span>₦{order.pricing.totalValue.toLocaleString()}</span></div>
                                </div>
                            </div>
                        </div>

                        {(order.escrow.status === 'held' || order.escrow.status === 'released') && (
                            <div className="card mb-4">
                                <div className="card-header">OTP / PIN (relay to sender &amp; recipient)</div>
                                <div className="card-body text-center">
                                    <p className="text-muted small mb-1">Pickup OTP</p>
                                    <div className="code-pill mb-3">{order.otp.pickupCode}</div>
                                    <p className="text-muted small mb-1">Delivery PIN</p>
                                    <div className="code-pill">{order.otp.deliveryPin}</div>
                                </div>
                            </div>
                        )}

                        <div className="card">
                            <div className="card-header">Assignment</div>
                            <div className="card-body">
                                <p className="mb-1"><strong>Mode:</strong> {order.dispatchMode}</p>
                                {assignedRider ? (
                                    <>
                                        <p className="mb-1"><strong>Rider:</strong> {assignedRider.firstName} {assignedRider.lastName}</p>
                                        <p className="mb-0"><strong>Phone:</strong> {assignedRider.phone}</p>
                                    </>
                                ) : (
                                    <p className="text-muted mb-0">
                                        Not yet assigned{order.dispatchMode === 'broadcast' ? ` — broadcast to ${order.eligibleRiders.length} rider(s)` : ''}.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
