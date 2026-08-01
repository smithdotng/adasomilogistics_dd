import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { RiderListing } from '@/models/RiderListing';
import { Order } from '@/models/Order';
import { Wallet } from '@/models/Wallet';
import { User } from '@/models/User';
import FlashMessage from '@/components/FlashMessage';
import RiderBadge from '@/components/illustrations/RiderBadge';
import { toggleAvailabilityAction } from '@/actions/rider';

export const metadata = { title: 'Rider Dashboard' };

export default async function RiderDashboardPage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    const authUser = await requireRole('rider');
    const params = await searchParams;
    await connectDB();

    const [verifiedCount, pendingCount, activeOrder, wallet, rider] = await Promise.all([
        RiderListing.countDocuments({ rider: authUser.id, status: 'approved' }),
        RiderListing.countDocuments({ rider: authUser.id, status: 'pending' }),
        Order.findOne({ assignedRider: authUser.id, status: { $in: ['assigned', 'picked_up'] } }).lean(),
        Wallet.findOne({ owner: authUser.id, role: 'rider' }).lean(),
        User.findById(authUser.id).lean()
    ]);

    const walletBalance = wallet ? wallet.balance : 0;
    const isAvailable = rider?.riderInfo?.isAvailable ?? false;
    const kycStatus = rider?.riderInfo?.kycStatus || 'submitted';

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={params.success} error={params.error} info={params.info} />

                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <p className="section-title mb-1">Rider</p>
                        <h2 className="mb-0">Welcome back, {authUser.firstName}</h2>
                    </div>
                    <form action={toggleAvailabilityAction}>
                        <button className={`btn ${isAvailable ? 'btn-peach' : 'btn-outline-peach'}`}>
                            <i className="fa-solid fa-power-off me-2"></i>{isAvailable ? 'Available for Dispatch' : 'Unavailable'}
                        </button>
                    </form>
                </div>

                <div className="card mb-4">
                    <div className="row g-0 align-items-center">
                        <div className="col-md-4">
                            <RiderBadge />
                        </div>
                        <div className="col-md-8">
                            <div className="p-4">
                                <h5 className="mb-1">Every trip, paid out fast</h5>
                                <p className="text-muted mb-0 small">
                                    Accept a delivery, confirm pickup with the sender&apos;s OTP, then confirm drop-off with the
                                    recipient&apos;s PIN — your logistics fee lands in your wallet the moment it&apos;s verified.
                                </p>
                            </div>
                        </div>
                    </div>
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
                            <div className="stat-icon"><i className="fa-solid fa-check-double"></i></div>
                            <div className="stat-value">{verifiedCount}</div>
                            <div className="stat-label">Verified Operators</div>
                        </div>
                    </div>
                    <div className="col-md-3 col-6">
                        <div className="stat-card">
                            <div className="stat-icon"><i className="fa-solid fa-hourglass-half"></i></div>
                            <div className="stat-value">{pendingCount}</div>
                            <div className="stat-label">Pending Requests</div>
                        </div>
                    </div>
                    <div className="col-md-3 col-6">
                        <div className="stat-card">
                            <div className="stat-icon"><i className="fa-solid fa-id-badge"></i></div>
                            <div className="stat-value"><span className={`badge-pill status-${kycStatus}`}>{kycStatus.replace(/_/g, ' ')}</span></div>
                            <div className="stat-label">KYC Status</div>
                        </div>
                    </div>
                </div>

                {activeOrder && (
                    <div className="card mb-4" style={{ borderColor: 'var(--thm-primary)' }}>
                        <div className="card-header">Active Delivery</div>
                        <div className="card-body d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <div>
                                <strong>{activeOrder.orderNumber}</strong> — {activeOrder.pickupAddress} → {activeOrder.dropoffAddress}
                                <div><span className={`badge-pill status-${activeOrder.status}`}>{activeOrder.status.replace(/_/g, ' ')}</span></div>
                            </div>
                            <Link href={`/rider/orders/${activeOrder._id}`} className="btn btn-peach">Continue Delivery</Link>
                        </div>
                    </div>
                )}

                <div className="row g-4">
                    <div className="col-md-6">
                        <Link href="/rider/orders" className="text-decoration-none">
                            <div className="role-card">
                                <div className="role-icon"><i className="fa-solid fa-list-check"></i></div>
                                <h5>Available Deliveries</h5>
                                <p className="text-muted mb-0">Browse broadcast orders eligible for your verified fleets.</p>
                            </div>
                        </Link>
                    </div>
                    <div className="col-md-6">
                        <Link href="/rider/verification" className="text-decoration-none">
                            <div className="role-card">
                                <div className="role-icon"><i className="fa-solid fa-building-shield"></i></div>
                                <h5>Request More Operators</h5>
                                <p className="text-muted mb-0">Get verified with additional commercial operators.</p>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
