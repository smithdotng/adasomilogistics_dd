import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { Order } from '@/models/Order';
import FlashMessage from '@/components/FlashMessage';

export const metadata = { title: 'My Deliveries' };

export default async function RiderMyDeliveriesPage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    const user = await requireRole('rider');
    const params = await searchParams;
    await connectDB();

    const orders = await Order.find({ assignedRider: user.id }).sort({ createdAt: -1 }).lean();

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={params.success} error={params.error} info={params.info} />

                <p className="section-title mb-1">History</p>
                <h2 className="mb-4">My Deliveries</h2>

                <div className="card">
                    <div className="card-body">
                        {orders.length === 0 ? (
                            <div className="empty-state"><i className="fa-solid fa-motorcycle"></i><p>You haven&apos;t taken any deliveries yet.</p></div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead><tr><th>Order</th><th>Route</th><th>Payout</th><th>Status</th><th></th></tr></thead>
                                    <tbody>
                                        {orders.map((o) => (
                                            <tr key={String(o._id)}>
                                                <td>{o.orderNumber}</td>
                                                <td className="small">{o.pickupAddress} → {o.dropoffAddress}</td>
                                                <td>₦{o.pricing.riderPayout.toLocaleString()}</td>
                                                <td><span className={`badge-pill status-${o.status}`}>{o.status.replace(/_/g, ' ')}</span></td>
                                                <td><Link href={`/rider/orders/${o._id}`} className="small">View</Link></td>
                                            </tr>
                                        ))}
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
