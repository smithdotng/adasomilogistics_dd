import Link from 'next/link';
import moment from 'moment';
import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { RiderListing } from '@/models/RiderListing';
import { Order } from '@/models/Order';
import { Dispute } from '@/models/Dispute';
import FlashMessage from '@/components/FlashMessage';

export const metadata = { title: 'Admin Dashboard' };

export default async function AdminDashboardPage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    await requireRole('admin');
    const params = await searchParams;
    await connectDB();

    const [merchantCount, riderCount, publicUserCount, totalOrders, completedOrders, disputedOrders, openDisputes] =
        await Promise.all([
            User.countDocuments({ role: 'merchant' }),
            User.countDocuments({ role: 'rider' }),
            User.countDocuments({ role: 'public_user' }),
            Order.countDocuments(),
            Order.countDocuments({ status: 'completed' }),
            Order.countDocuments({ status: 'disputed' }),
            Dispute.countDocuments({ status: { $in: ['open', 'investigating'] } })
        ]);

    const decidedListings = await RiderListing.find({ status: 'approved', decidedAt: { $exists: true } }).lean();
    let avgVerificationHours = 0;
    if (decidedListings.length) {
        const totalHours = decidedListings.reduce(
            (sum, l) => sum + moment(l.decidedAt).diff(moment(l.requestedAt), 'hours', true),
            0
        );
        avgVerificationHours = Math.round((totalHours / decidedListings.length) * 10) / 10;
    }

    const settledOrders = completedOrders + disputedOrders;
    const completionRate = settledOrders ? Math.round((completedOrders / settledOrders) * 1000) / 10 : 0;

    const payoutOrders = await Order.find({
        status: 'completed',
        'otp.deliveryVerifiedAt': { $exists: true },
        'escrow.releasedAt': { $exists: true }
    })
        .limit(200)
        .lean();
    let avgPayoutSeconds = 0;
    if (payoutOrders.length) {
        const totalSeconds = payoutOrders.reduce(
            (sum, o) => sum + moment(o.escrow.releasedAt).diff(moment(o.otp.deliveryVerifiedAt), 'seconds', true),
            0
        );
        avgPayoutSeconds = Math.round((totalSeconds / payoutOrders.length) * 10) / 10;
    }

    const sinceDate = moment().subtract(7, 'days').toDate();
    const riders = await User.find({ role: 'rider' }).lean();
    let utilizedCount = 0;
    for (const rider of riders) {
        const trips = await Order.countDocuments({
            assignedRider: rider._id,
            status: 'completed',
            updatedAt: { $gte: sinceDate }
        });
        if (trips >= 5) utilizedCount++;
    }
    const riderUtilizationRate = riders.length ? Math.round((utilizedCount / riders.length) * 1000) / 10 : 0;

    const recentOrders = await Order.find()
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('merchant')
        .populate('customer')
        .populate('assignedRider')
        .lean();

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={params.success} error={params.error} info={params.info} />

                <p className="section-title mb-1">Platform Oversight</p>
                <h2 className="mb-4">Admin Dashboard</h2>

                <div className="row g-4 mb-4">
                    <div className="col-md-3 col-6">
                        <div className="stat-card"><div className="stat-icon"><i className="fa-solid fa-store"></i></div><div className="stat-value">{merchantCount}</div><div className="stat-label">Merchants</div></div>
                    </div>
                    <div className="col-md-3 col-6">
                        <div className="stat-card"><div className="stat-icon"><i className="fa-solid fa-motorcycle"></i></div><div className="stat-value">{riderCount}</div><div className="stat-label">Riders</div></div>
                    </div>
                    <div className="col-md-3 col-6">
                        <div className="stat-card"><div className="stat-icon"><i className="fa-solid fa-user"></i></div><div className="stat-value">{publicUserCount}</div><div className="stat-label">Public Users</div></div>
                    </div>
                    <div className="col-md-3 col-6">
                        <div className="stat-card"><div className="stat-icon"><i className="fa-solid fa-box"></i></div><div className="stat-value">{totalOrders}</div><div className="stat-label">Total Orders</div></div>
                    </div>
                </div>

                <p className="section-title mb-3">Key Performance Indicators</p>
                <div className="row g-4 mb-4">
                    <div className="col-md-3 col-6">
                        <div className="stat-card gradient">
                            <div className="stat-icon"><i className="fa-solid fa-stopwatch"></i></div>
                            <div className="stat-value">{avgVerificationHours}h</div>
                            <div className="stat-label">Avg Verification Time</div>
                            <div className="small mt-1" style={{ opacity: 0.85 }}>Target: &lt; 24h</div>
                        </div>
                    </div>
                    <div className="col-md-3 col-6">
                        <div className="stat-card gradient">
                            <div className="stat-icon"><i className="fa-solid fa-circle-check"></i></div>
                            <div className="stat-value">{completionRate}%</div>
                            <div className="stat-label">Order Completion Rate</div>
                            <div className="small mt-1" style={{ opacity: 0.85 }}>Target: &gt; 98%</div>
                        </div>
                    </div>
                    <div className="col-md-3 col-6">
                        <div className="stat-card gradient">
                            <div className="stat-icon"><i className="fa-solid fa-bolt"></i></div>
                            <div className="stat-value">{avgPayoutSeconds}s</div>
                            <div className="stat-label">Payout Velocity</div>
                            <div className="small mt-1" style={{ opacity: 0.85 }}>Target: &lt; 30s</div>
                        </div>
                    </div>
                    <div className="col-md-3 col-6">
                        <div className="stat-card gradient">
                            <div className="stat-icon"><i className="fa-solid fa-gauge-high"></i></div>
                            <div className="stat-value">{riderUtilizationRate}%</div>
                            <div className="stat-label">Rider Utilization</div>
                            <div className="small mt-1" style={{ opacity: 0.85 }}>≥5 trips/week</div>
                        </div>
                    </div>
                </div>

                <div className="row g-4 mb-4">
                    <div className="col-md-6">
                        <div className="stat-card">
                            <div className="stat-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
                            <div className="stat-value">{openDisputes}</div>
                            <div className="stat-label">Open Disputes</div>
                            <Link href="/admin/disputes" className="small">Review disputes →</Link>
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="stat-card">
                            <div className="stat-icon"><i className="fa-solid fa-sliders"></i></div>
                            <div className="stat-value">Pricing</div>
                            <div className="stat-label">Commission &amp; Fees</div>
                            <Link href="/admin/config" className="small">Adjust configuration →</Link>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header d-flex justify-content-between align-items-center">
                        Recent Orders
                        <Link href="/admin/orders" className="small">View all</Link>
                    </div>
                    <div className="card-body">
                        {recentOrders.length === 0 ? (
                            <div className="empty-state"><i className="fa-solid fa-box-open"></i><p>No orders on the platform yet.</p></div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead><tr><th>Order</th><th>Type</th><th>Total</th><th>Status</th><th>Created</th></tr></thead>
                                    <tbody>
                                        {recentOrders.map((o) => (
                                            <tr key={String(o._id)}>
                                                <td>{o.orderNumber}</td>
                                                <td>{o.type}</td>
                                                <td>₦{o.pricing.totalValue.toLocaleString()}</td>
                                                <td><span className={`badge-pill status-${o.status}`}>{o.status.replace(/_/g, ' ')}</span></td>
                                                <td>{moment(o.createdAt).format('MMM D, h:mm A')}</td>
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
