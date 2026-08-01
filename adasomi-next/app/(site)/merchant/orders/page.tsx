import Link from 'next/link';
import moment from 'moment';
import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { Order } from '@/models/Order';
import FlashMessage from '@/components/FlashMessage';

export const metadata = { title: 'Orders' };

export default async function MerchantOrdersPage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    const user = await requireRole('merchant');
    const params = await searchParams;
    await connectDB();

    const orders = await Order.find({ merchant: user.id }).sort({ createdAt: -1 }).lean();

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={params.success} error={params.error} info={params.info} />

                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <h2 className="mb-0">Orders</h2>
                    <Link href="/merchant/orders/new" className="btn btn-peach">
                        <i className="fa-solid fa-plus me-2"></i>Dispatch New Order
                    </Link>
                </div>
                <div className="card">
                    <div className="card-body">
                        {orders.length === 0 ? (
                            <div className="empty-state"><i className="fa-solid fa-box-open"></i><p>No orders yet.</p></div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead>
                                        <tr><th>Order</th><th>Recipient</th><th>Distance</th><th>Total</th><th>Status</th><th>Created</th><th></th></tr>
                                    </thead>
                                    <tbody>
                                        {orders.map((o) => (
                                            <tr key={String(o._id)}>
                                                <td>{o.orderNumber}</td>
                                                <td>{o.recipientName}</td>
                                                <td>{o.distanceKm} km</td>
                                                <td>₦{o.pricing.totalValue.toLocaleString()}</td>
                                                <td><span className={`badge-pill status-${o.status}`}>{o.status.replace(/_/g, ' ')}</span></td>
                                                <td>{moment(o.createdAt).format('MMM D, h:mm A')}</td>
                                                <td><Link href={`/merchant/orders/${o._id}`} className="small">View</Link></td>
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
