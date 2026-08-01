import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { Order } from '@/models/Order';
import FlashMessage from '@/components/FlashMessage';
import { acceptOrderAction } from '@/actions/rider';

export const metadata = { title: 'Available Deliveries' };

export default async function RiderAvailableOrdersPage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    const user = await requireRole('rider');
    const params = await searchParams;
    await connectDB();

    const orders = await Order.find({
        status: 'awaiting_assignment',
        assignedRider: { $exists: false },
        eligibleRiders: user.id
    })
        .sort({ createdAt: -1 })
        .populate('merchant')
        .lean();

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={params.success} error={params.error} info={params.info} />

                <p className="section-title mb-1">Dispatch Pool</p>
                <h2 className="mb-4">Available Deliveries</h2>

                {orders.length === 0 ? (
                    <div className="empty-state"><i className="fa-solid fa-inbox"></i><p>No deliveries available right now. Check back soon.</p></div>
                ) : (
                    <div className="row g-4">
                        {orders.map((o) => {
                            const merchant = o.merchant as unknown as { merchantInfo?: { businessName?: string }; firstName?: string; lastName?: string } | null;
                            const merchantLabel = merchant
                                ? merchant.merchantInfo?.businessName || `${merchant.firstName} ${merchant.lastName}`
                                : 'Public request';
                            return (
                                <div className="col-md-6" key={String(o._id)}>
                                    <div className="card">
                                        <div className="card-body">
                                            <div className="d-flex justify-content-between align-items-start mb-2">
                                                <strong>{o.orderNumber}</strong>
                                                <span className={`badge-pill status-${o.type}`}>{o.type}</span>
                                            </div>
                                            <p className="mb-1 small"><i className="fa-solid fa-circle text-success me-1"></i>{o.pickupAddress}</p>
                                            <p className="mb-2 small"><i className="fa-solid fa-circle text-danger me-1"></i>{o.dropoffAddress}</p>
                                            <p className="mb-3 text-muted small">{o.distanceKm} km &middot; {merchantLabel}</p>
                                            <div className="d-flex justify-content-between align-items-center">
                                                <strong>₦{o.pricing.riderPayout.toLocaleString()} <span className="text-muted fw-normal small">payout</span></strong>
                                                <form action={acceptOrderAction}>
                                                    <input type="hidden" name="orderId" value={String(o._id)} />
                                                    <button className="btn btn-peach btn-sm">Accept</button>
                                                </form>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
