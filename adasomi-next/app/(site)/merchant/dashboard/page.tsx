import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { RiderListing } from '@/models/RiderListing';
import { Order } from '@/models/Order';
import { Wallet } from '@/models/Wallet';
import FlashMessage from '@/components/FlashMessage';

export const metadata = { title: 'Merchant Dashboard' };

const TYPE_ICONS: Record<string, string> = {
    restaurant: 'fa-utensils',
    food_vendor: 'fa-store',
    food_processor: 'fa-industry',
    produce_aggregator: 'fa-carrot'
};
const TYPE_LABELS: Record<string, string> = {
    restaurant: 'Restaurant',
    food_vendor: 'Food Vendor',
    food_processor: 'Food Processor',
    produce_aggregator: 'Produce Aggregator'
};

export default async function MerchantDashboardPage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    const user = await requireRole('merchant');
    const params = await searchParams;
    await connectDB();

    const [fleetCount, pendingRequests, activeOrders, wallet, recentOrders] = await Promise.all([
        RiderListing.countDocuments({ merchant: user.id, status: 'approved' }),
        RiderListing.countDocuments({ merchant: user.id, status: 'pending' }),
        Order.countDocuments({ merchant: user.id, status: { $nin: ['completed', 'cancelled'] } }),
        Wallet.findOne({ owner: user.id, role: 'merchant' }).lean(),
        Order.find({ merchant: user.id }).sort({ createdAt: -1 }).limit(6).lean()
    ]);

    const walletBalance = wallet ? wallet.balance : 0;
    const businessType = user.merchantInfo?.businessType;

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={params.success} error={params.error} info={params.info} />

                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <p className="section-title mb-1">Merchant</p>
                        <h2 className="mb-1">Welcome back, {user.merchantInfo?.businessName || user.firstName}</h2>
                        {businessType && (
                            <span className="business-type-chip">
                                <i className={`fa-solid ${TYPE_ICONS[businessType] || 'fa-store'}`}></i>
                                {TYPE_LABELS[businessType] || businessType}
                            </span>
                        )}
                    </div>
                    <Link href="/merchant/orders/new" className="btn btn-peach">
                        <i className="fa-solid fa-plus me-2"></i>Dispatch New Order
                    </Link>
                </div>

                <div className="row g-4 mb-4">
                    <div className="col-md-3 col-6">
                        <div className="stat-card gradient">
                            <div className="stat-icon"><i className="fa-solid fa-wallet"></i></div>
                            <div className="stat-value">₦{walletBalance.toLocaleString()}</div>
                            <div className="stat-label">Wallet Balance</div>
                        </div>
                    </div>
                    <div className="col-md-3 col-6">
                        <div className="stat-card">
                            <div className="stat-icon"><i className="fa-solid fa-motorcycle"></i></div>
                            <div className="stat-value">{fleetCount}</div>
                            <div className="stat-label">Verified Fleet</div>
                        </div>
                    </div>
                    <div className="col-md-3 col-6">
                        <div className="stat-card">
                            <div className="stat-icon"><i className="fa-solid fa-hourglass-half"></i></div>
                            <div className="stat-value">{pendingRequests}</div>
                            <div className="stat-label">Pending Requests</div>
                        </div>
                    </div>
                    <div className="col-md-3 col-6">
                        <div className="stat-card">
                            <div className="stat-icon"><i className="fa-solid fa-box"></i></div>
                            <div className="stat-value">{activeOrders}</div>
                            <div className="stat-label">Active Orders</div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header d-flex justify-content-between align-items-center">
                        Recent Orders
                        <Link href="/merchant/orders" className="small">View all</Link>
                    </div>
                    <div className="card-body">
                        {recentOrders.length === 0 ? (
                            <div className="empty-state">
                                <i className="fa-solid fa-box-open"></i>
                                <p>No orders yet. Dispatch your first delivery to get started.</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead>
                                        <tr><th>Order</th><th>Recipient</th><th>Total</th><th>Status</th><th></th></tr>
                                    </thead>
                                    <tbody>
                                        {recentOrders.map((o) => (
                                            <tr key={String(o._id)}>
                                                <td>{o.orderNumber}</td>
                                                <td>{o.recipientName}</td>
                                                <td>₦{o.pricing.totalValue.toLocaleString()}</td>
                                                <td><span className={`badge-pill status-${o.status}`}>{o.status.replace(/_/g, ' ')}</span></td>
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
