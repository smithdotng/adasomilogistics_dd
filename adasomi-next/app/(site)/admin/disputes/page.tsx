import moment from 'moment';
import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { Dispute } from '@/models/Dispute';
import FlashMessage from '@/components/FlashMessage';
import { resolveDisputeAction } from '@/actions/admin';

export const metadata = { title: 'Disputes' };

export default async function AdminDisputesPage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    await requireRole('admin');
    const params = await searchParams;
    await connectDB();

    const disputes = await Dispute.find().sort({ createdAt: -1 }).populate('order').populate('raisedBy').lean();

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={params.success} error={params.error} info={params.info} />

                <p className="section-title mb-1">Resolution Center</p>
                <h2 className="mb-4">Disputes</h2>

                <div className="card">
                    <div className="card-body">
                        {disputes.length === 0 ? (
                            <div className="empty-state"><i className="fa-solid fa-handshake"></i><p>No disputes have been raised.</p></div>
                        ) : (
                            disputes.map((d) => {
                                const order = d.order as unknown as { orderNumber?: string } | null;
                                const raisedBy = d.raisedBy as unknown as { firstName?: string; lastName?: string } | null;
                                return (
                                    <div className="border-bottom pb-3 mb-3" key={String(d._id)}>
                                        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                                            <div>
                                                <strong>{order ? order.orderNumber : 'Order removed'}</strong>
                                                <span className={`badge-pill status-${d.status} ms-2`}>{d.status}</span>
                                                <p className="text-muted small mb-1 mt-1">
                                                    Raised by {raisedBy ? `${raisedBy.firstName} ${raisedBy.lastName}` : 'Unknown'} · {moment(d.createdAt).fromNow()}
                                                </p>
                                                <p className="mb-0">{d.reason}</p>
                                                {d.resolutionNotes && <p className="text-muted small mt-1">Resolution: {d.resolutionNotes}</p>}
                                            </div>
                                            {['open', 'investigating'].includes(d.status) && (
                                                <form action={resolveDisputeAction} className="d-flex gap-2 flex-wrap" style={{ minWidth: 280 }}>
                                                    <input type="hidden" name="disputeId" value={String(d._id)} />
                                                    <input type="text" className="form-control form-control-sm" name="resolutionNotes" placeholder="Resolution notes" />
                                                    <button className="btn btn-peach btn-sm" name="decision" value="resolve">Resolve</button>
                                                    <button className="btn btn-danger-soft btn-sm" name="decision" value="reject">Reject</button>
                                                </form>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
