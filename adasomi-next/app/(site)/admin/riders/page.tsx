import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { RiderListing } from '@/models/RiderListing';
import FlashMessage from '@/components/FlashMessage';
import { decideKycAction } from '@/actions/admin';

export const metadata = { title: 'Rider KYC Audit' };

export default async function AdminRidersPage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    await requireRole('admin');
    const params = await searchParams;
    await connectDB();

    const [riders, listingCounts] = await Promise.all([
        User.find({ role: 'rider' }).sort({ createdAt: -1 }).lean(),
        RiderListing.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: '$rider', count: { $sum: 1 } } }])
    ]);

    const countsMap: Record<string, number> = {};
    listingCounts.forEach((c: { _id: unknown; count: number }) => {
        countsMap[String(c._id)] = c.count;
    });

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={params.success} error={params.error} info={params.info} />

                <p className="section-title mb-1">Compliance</p>
                <h2 className="mb-4">Rider KYC Audit</h2>

                <div className="card">
                    <div className="card-body">
                        {riders.length === 0 ? (
                            <div className="empty-state"><i className="fa-solid fa-id-card"></i><p>No riders registered yet.</p></div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead><tr><th>Rider</th><th>Vehicle</th><th>Verified Operators</th><th>KYC Status</th><th>Update</th></tr></thead>
                                    <tbody>
                                        {riders.map((r) => (
                                            <tr key={String(r._id)}>
                                                <td>{r.firstName} {r.lastName}<br /><small className="text-muted">{r.email}</small></td>
                                                <td>{r.riderInfo?.vehicleType ? `${r.riderInfo.vehicleType.replace(/_/g, ' ')} · ${r.riderInfo.vehiclePlate || ''}` : '—'}</td>
                                                <td>{countsMap[String(r._id)] || 0}</td>
                                                <td><span className={`badge-pill status-${r.riderInfo?.kycStatus || 'submitted'}`}>{(r.riderInfo?.kycStatus || 'submitted').replace(/_/g, ' ')}</span></td>
                                                <td>
                                                    <form action={decideKycAction} className="d-flex gap-2">
                                                        <input type="hidden" name="riderId" value={String(r._id)} />
                                                        <select name="kycStatus" className="form-select form-select-sm" defaultValue={r.riderInfo?.kycStatus || 'submitted'}>
                                                            <option value="submitted">Submitted</option>
                                                            <option value="under_review">Under Review</option>
                                                            <option value="verified">Verified</option>
                                                            <option value="rejected">Rejected</option>
                                                        </select>
                                                        <button className="btn btn-outline-peach btn-sm">Save</button>
                                                    </form>
                                                </td>
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
