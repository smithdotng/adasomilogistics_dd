import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { Order } from '@/models/Order';
import FlashMessage from '@/components/FlashMessage';

export const metadata = { title: 'All Orders' };

export default async function AdminOrdersPage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    await requireRole('admin');
    const params = await searchParams;
    await connectDB();

    const orders = await Order.find()
        .sort({ createdAt: -1 })
        .limit(100)
        .populate('merchant')
        .populate('customer')
        .populate('assignedRider')
        .lean();

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={params.success} error={params.error} info={params.info} />

                <p className="section-title mb-1">Platform-wide</p>
                <h2 className="mb-4">All Orders</h2>

                <div className="card">
                    <div className="card-body">
                        {orders.length === 0 ? (
                            <div className="empty-state"><i className="fa-solid fa-box-open"></i><p>No orders yet.</p></div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead>
                                        <tr><th>Order</th><th>Type</th><th>Merchant / Customer</th><th>Rider</th><th>Total</th><th>Status</th></tr>
                                    </thead>
                                    <tbody>
                                        {orders.map((o) => {
                                            const merchant = o.merchant as unknown as {
                                                merchantInfo?: { businessName?: string };
                                                firstName?: string;
                                                lastName?: string;
                                            } | null;
                                            const customer = o.customer as unknown as { firstName?: string; lastName?: string } | null;
                                            const rider = o.assignedRider as unknown as { firstName?: string; lastName?: string } | null;
                                            const partyLabel = merchant
                                                ? merchant.merchantInfo?.businessName || `${merchant.firstName} ${merchant.lastName}`
                                                : customer
                                                  ? `${customer.firstName} ${customer.lastName}`
                                                  : '—';
                                            return (
                                                <tr key={String(o._id)}>
                                                    <td>{o.orderNumber}</td>
                                                    <td>{o.type}</td>
                                                    <td>{partyLabel}</td>
                                                    <td>{rider ? `${rider.firstName} ${rider.lastName}` : '—'}</td>
                                                    <td>₦{o.pricing.totalValue.toLocaleString()}</td>
                                                    <td><span className={`badge-pill status-${o.status}`}>{o.status.replace(/_/g, ' ')}</span></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
