import moment from 'moment';
import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { RiderListing } from '@/models/RiderListing';
import FlashMessage from '@/components/FlashMessage';
import { requestListingAction } from '@/actions/rider';

export const metadata = { title: 'Operator Verification' };

export default async function RiderVerificationPage({
    searchParams
}: {
    searchParams: Promise<{ q?: string; success?: string; error?: string; info?: string }>;
}) {
    const user = await requireRole('rider');
    const params = await searchParams;
    const q = (params.q || '').trim();
    await connectDB();

    const [listings, searchResults] = await Promise.all([
        RiderListing.find({ rider: user.id }).populate('merchant').sort({ createdAt: -1 }).lean(),
        q
            ? User.find({
                  role: 'merchant',
                  $or: [{ 'merchantInfo.businessName': new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }]
              })
                  .limit(20)
                  .lean()
            : Promise.resolve(null)
    ]);

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={params.success} error={params.error} info={params.info} />

                <p className="section-title mb-1">Fleet Verification</p>
                <h2 className="mb-4">Get listed with commercial operators</h2>

                <div className="card mb-4">
                    <div className="card-header">Search operators</div>
                    <div className="card-body">
                        <form action="/rider/verification" method="GET" className="d-flex gap-2 mb-3">
                            <input type="text" className="form-control" name="q" defaultValue={q} placeholder="Search by business name or email" />
                            <button className="btn btn-outline-peach" type="submit"><i className="fa-solid fa-magnifying-glass"></i></button>
                        </form>
                        {searchResults && searchResults.length > 0 ? (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead><tr><th>Business</th><th>Type</th><th>Email</th><th></th></tr></thead>
                                    <tbody>
                                        {searchResults.map((m) => (
                                            <tr key={String(m._id)}>
                                                <td>{m.merchantInfo?.businessName || `${m.firstName} ${m.lastName}`}</td>
                                                <td>{m.merchantInfo?.businessType ? m.merchantInfo.businessType.replace(/_/g, ' ') : '—'}</td>
                                                <td>{m.email}</td>
                                                <td>
                                                    <form action={requestListingAction}>
                                                        <input type="hidden" name="merchantId" value={String(m._id)} />
                                                        <button className="btn btn-peach btn-sm" type="submit">Request Listing</button>
                                                    </form>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : q ? (
                            <p className="text-muted mb-0">No operators found matching &quot;{q}&quot;.</p>
                        ) : null}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">My Listings</div>
                    <div className="card-body">
                        {listings.length === 0 ? (
                            <div className="empty-state"><i className="fa-solid fa-building-shield"></i><p>You haven&apos;t requested any operators yet.</p></div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead><tr><th>Operator</th><th>Status</th><th>Requested</th></tr></thead>
                                    <tbody>
                                        {listings.map((l) => {
                                            const merchant = l.merchant as unknown as { merchantInfo?: { businessName?: string }; firstName: string; lastName: string };
                                            return (
                                                <tr key={String(l._id)}>
                                                    <td>{merchant.merchantInfo?.businessName || `${merchant.firstName} ${merchant.lastName}`}</td>
                                                    <td><span className={`badge-pill status-${l.status}`}>{l.status}</span></td>
                                                    <td>{moment(l.requestedAt).fromNow()}</td>
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
