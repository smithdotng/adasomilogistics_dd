import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { RiderListing } from '@/models/RiderListing';
import { User } from '@/models/User';
import FlashMessage from '@/components/FlashMessage';
import { inviteRiderAction, decideRiderRequestAction } from '@/actions/merchant';
import moment from 'moment';

export const metadata = { title: 'Fleet & Riders' };

export default async function MerchantRidersPage({
    searchParams
}: {
    searchParams: Promise<{ q?: string; success?: string; error?: string; info?: string }>;
}) {
    const user = await requireRole('merchant');
    const params = await searchParams;
    const q = (params.q || '').trim();
    await connectDB();

    const [pending, fleet, searchResults] = await Promise.all([
        RiderListing.find({ merchant: user.id, status: 'pending' }).populate('rider').sort({ createdAt: -1 }).lean(),
        RiderListing.find({ merchant: user.id, status: 'approved' }).populate('rider').sort({ createdAt: -1 }).lean(),
        q
            ? User.find({
                  role: 'rider',
                  $or: [{ email: new RegExp(q, 'i') }, { firstName: new RegExp(q, 'i') }, { lastName: new RegExp(q, 'i') }]
              })
                  .limit(20)
                  .lean()
            : Promise.resolve(null)
    ]);

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={params.success} error={params.error} info={params.info} />

                <p className="section-title mb-1">Fleet Governance</p>
                <h2 className="mb-4">Riders &amp; Verification</h2>

                <div className="card mb-4">
                    <div className="card-header">Search &amp; invite a registered rider</div>
                    <div className="card-body">
                        <form action="/merchant/riders" method="GET" className="d-flex gap-2 mb-3">
                            <input type="text" className="form-control" name="q" defaultValue={q} placeholder="Search by name or email" />
                            <button className="btn btn-outline-peach" type="submit"><i className="fa-solid fa-magnifying-glass"></i></button>
                        </form>
                        {searchResults && searchResults.length > 0 ? (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead><tr><th>Name</th><th>Email</th><th>Vehicle</th><th>KYC</th><th></th></tr></thead>
                                    <tbody>
                                        {searchResults.map((r) => (
                                            <tr key={String(r._id)}>
                                                <td>{r.firstName} {r.lastName}</td>
                                                <td>{r.email}</td>
                                                <td>{r.riderInfo?.vehicleType ? r.riderInfo.vehicleType.replace(/_/g, ' ') : '—'}</td>
                                                <td><span className={`badge-pill status-${r.riderInfo?.kycStatus || 'submitted'}`}>{(r.riderInfo?.kycStatus || 'submitted').replace(/_/g, ' ')}</span></td>
                                                <td>
                                                    <form action={inviteRiderAction}>
                                                        <input type="hidden" name="riderId" value={String(r._id)} />
                                                        <button className="btn btn-peach btn-sm" type="submit">Add to Fleet</button>
                                                    </form>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : q ? (
                            <p className="text-muted mb-0">No riders found matching &quot;{q}&quot;.</p>
                        ) : null}
                    </div>
                </div>

                <div className="card mb-4">
                    <div className="card-header">Pending Verification Requests ({pending.length})</div>
                    <div className="card-body">
                        {pending.length === 0 ? (
                            <div className="empty-state py-3"><i className="fa-solid fa-inbox"></i><p className="mb-0">No pending requests.</p></div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead><tr><th>Rider</th><th>Vehicle</th><th>Requested</th><th></th></tr></thead>
                                    <tbody>
                                        {pending.map((l) => {
                                            const rider = l.rider as unknown as {
                                                _id: unknown; firstName: string; lastName: string; email: string;
                                                riderInfo?: { vehicleType?: string; vehiclePlate?: string };
                                            };
                                            return (
                                                <tr key={String(l._id)}>
                                                    <td>{rider.firstName} {rider.lastName}<br /><small className="text-muted">{rider.email}</small></td>
                                                    <td>{rider.riderInfo?.vehicleType ? rider.riderInfo.vehicleType.replace(/_/g, ' ') : '—'} · {rider.riderInfo?.vehiclePlate || ''}</td>
                                                    <td>{moment(l.requestedAt).fromNow()}</td>
                                                    <td className="d-flex gap-2">
                                                        <form action={decideRiderRequestAction}>
                                                            <input type="hidden" name="listingId" value={String(l._id)} />
                                                            <input type="hidden" name="decision" value="approve" />
                                                            <button className="btn btn-peach btn-sm" type="submit">Approve</button>
                                                        </form>
                                                        <form action={decideRiderRequestAction}>
                                                            <input type="hidden" name="listingId" value={String(l._id)} />
                                                            <input type="hidden" name="decision" value="reject" />
                                                            <button className="btn btn-danger-soft btn-sm" type="submit">Reject</button>
                                                        </form>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">Verified Fleet ({fleet.length})</div>
                    <div className="card-body">
                        {fleet.length === 0 ? (
                            <div className="empty-state py-3"><i className="fa-solid fa-motorcycle"></i><p className="mb-0">No verified riders yet.</p></div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead><tr><th>Rider</th><th>Phone</th><th>Vehicle</th><th>Verified Since</th></tr></thead>
                                    <tbody>
                                        {fleet.map((l) => {
                                            const rider = l.rider as unknown as {
                                                firstName: string; lastName: string; phone: string;
                                                riderInfo?: { vehicleType?: string };
                                            };
                                            return (
                                                <tr key={String(l._id)}>
                                                    <td>{rider.firstName} {rider.lastName}</td>
                                                    <td>{rider.phone}</td>
                                                    <td>{rider.riderInfo?.vehicleType ? rider.riderInfo.vehicleType.replace(/_/g, ' ') : '—'}</td>
                                                    <td>{l.decidedAt ? moment(l.decidedAt).format('MMM D, YYYY') : '—'}</td>
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
