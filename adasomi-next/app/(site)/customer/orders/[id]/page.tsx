import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { Order } from '@/models/Order';
import FlashMessage from '@/components/FlashMessage';
import TrackingMap from '@/components/TrackingMap';
import { customerFundEscrowAction, customerCancelOrderAction, customerRaiseDisputeAction } from '@/actions/customer';

export const metadata = { title: 'Request Detail' };

export default async function CustomerOrderDetailPage({
    params,
    searchParams
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    const user = await requireRole('public_user');
    const { id } = await params;
    const sp = await searchParams;
    await connectDB();

    const order = await Order.findOne({ _id: id, customer: user.id }).populate('assignedRider').lean();
    if (!order) {
        redirect(`/customer/dashboard?error=${encodeURIComponent('Request not found.')}`);
    }

    const assignedRider = order.assignedRider as unknown as {
        firstName: string;
        lastName: string;
        phone: string;
        riderInfo?: { vehicleType?: string };
    } | null;

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={sp.success} error={sp.error} info={sp.info} />

                <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
                    <div>
                        <p className="section-title mb-1">Request {order.orderNumber}</p>
                        <h2 className="mb-0">
                            <span className={`badge-pill status-${order.status}`}>{order.status.replace(/_/g, ' ')}</span>
                        </h2>
                    </div>
                    <div className="d-flex gap-2">
                        {order.status === 'awaiting_payment' && (
                            <form action={customerFundEscrowAction}>
                                <input type="hidden" name="orderId" value={String(order._id)} />
                                <button className="btn btn-peach">
                                    <i className="fa-solid fa-lock me-2"></i>Pay ₦{order.pricing.totalValue.toLocaleString()}
                                </button>
                            </form>
                        )}
                        {['awaiting_payment', 'awaiting_assignment', 'assigned'].includes(order.status) && (
                            <form action={customerCancelOrderAction}>
                                <input type="hidden" name="orderId" value={String(order._id)} />
                                <button className="btn btn-danger-soft">Cancel</button>
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

                        {!['completed', 'cancelled'].includes(order.status) && (
                            <div className="card">
                                <div className="card-header">Raise a Dispute</div>
                                <div className="card-body">
                                    <form action={customerRaiseDisputeAction}>
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
                            <div className="card-header">Fee Breakdown</div>
                            <div className="card-body">
                                <div className="pricing-box">
                                    <div className="row-line"><span>Base Fee</span><span>₦{order.pricing.baseFee.toLocaleString()}</span></div>
                                    <div className="row-line"><span>Distance Cost ({order.distanceKm} km)</span><span>₦{order.pricing.distanceCost.toLocaleString()}</span></div>
                                    <div className="row-line"><span>Peak Surcharge</span><span>₦{order.pricing.peakSurcharge.toLocaleString()}</span></div>
                                    <div className="row-line total"><span>Total Paid</span><span>₦{order.pricing.totalValue.toLocaleString()}</span></div>
                                </div>
                            </div>
                        </div>

                        {(order.escrow.status === 'held' || order.escrow.status === 'released') && (
                            <div className="card mb-4">
                                <div className="card-header">OTP / PIN (share with rider &amp; recipient)</div>
                                <div className="card-body text-center">
                                    <p className="text-muted small mb-1">Give this to the rider at pickup</p>
                                    <div className="code-pill mb-3">{order.otp.pickupCode}</div>
                                    <p className="text-muted small mb-1">Give this to the recipient at delivery</p>
                                    <div className="code-pill">{order.otp.deliveryPin}</div>
                                </div>
                            </div>
                        )}

                        <div className="card">
                            <div className="card-header">Rider</div>
                            <div className="card-body">
                                {assignedRider ? (
                                    <>
                                        <p className="mb-1"><strong>{assignedRider.firstName} {assignedRider.lastName}</strong></p>
                                        <p className="mb-0 text-muted">
                                            {assignedRider.phone} · {assignedRider.riderInfo?.vehicleType ? assignedRider.riderInfo.vehicleType.replace(/_/g, ' ') : ''}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-muted mb-0">Searching for a nearby verified rider…</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
