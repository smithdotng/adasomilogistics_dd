import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { Order } from '@/models/Order';
import FlashMessage from '@/components/FlashMessage';
import Parcel from '@/components/illustrations/Parcel';

export const metadata = { title: 'My Requests' };

export default async function CustomerDashboardPage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    const user = await requireRole('public_user');
    const params = await searchParams;
    await connectDB();

    const [orders, activeCount] = await Promise.all([
        Order.find({ customer: user.id }).sort({ createdAt: -1 }).limit(10).lean(),
        Order.countDocuments({ customer: user.id, status: { $nin: ['completed', 'cancelled'] } })
    ]);

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={params.success} error={params.error} info={params.info} />

                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <p className="section-title mb-1">Public Dispatch</p>
                        <h2 className="mb-0">Hi {user.firstName}, where are we sending something today?</h2>
                    </div>
                    <Link href="/customer/orders/new" className="btn btn-peach">
                        <i className="fa-solid fa-plus me-2"></i>Request a Rider
                    </Link>
                </div>

                <div className="card mb-4">
                    <div className="row g-0 align-items-center">
                        <div className="col-md-4">
                            <Parcel />
                        </div>
                        <div className="col-md-8">
                            <div className="p-4">
                                <h5 className="mb-1">Drop a pin, get a verified rider</h5>
                                <p className="text-muted mb-0 small">
                                    Set your pickup and drop-off on the map, pay the logistics fee up front, and track your
                                    rider live until the delivery PIN confirms it&apos;s done.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="row g-4 mb-4">
                    <div className="col-md-4">
                        <div className="stat-card gradient">
                            <div className="stat-icon"><i className="fa-solid fa-box"></i></div>
                            <div className="stat-value">{activeCount}</div>
                            <div className="stat-label">Active Requests</div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">Recent Requests</div>
                    <div className="card-body">
                        {orders.length === 0 ? (
                            <div className="empty-state"><i className="fa-solid fa-box-open"></i><p>No delivery requests yet. Request your first rider now.</p></div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead><tr><th>Request</th><th>Route</th><th>Fee</th><th>Status</th><th></th></tr></thead>
                                    <tbody>
                                        {orders.map((o) => (
                                            <tr key={String(o._id)}>
                                                <td>{o.orderNumber}</td>
                                                <td className="small">{o.pickupAddress} → {o.dropoffAddress}</td>
                                                <td>₦{o.pricing.totalValue.toLocaleString()}</td>
                                                <td><span className={`badge-pill status-${o.status}`}>{o.status.replace(/_/g, ' ')}</span></td>
                                                <td><Link href={`/customer/orders/${o._id}`} className="small">View</Link></td>
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
