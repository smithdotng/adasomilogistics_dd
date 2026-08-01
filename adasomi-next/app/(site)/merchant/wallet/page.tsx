import moment from 'moment';
import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { Wallet } from '@/models/Wallet';
import { Transaction } from '@/models/Transaction';
import FlashMessage from '@/components/FlashMessage';

export const metadata = { title: 'Wallet' };

export default async function MerchantWalletPage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    const user = await requireRole('merchant');
    const params = await searchParams;
    await connectDB();

    const wallet = await Wallet.findOne({ owner: user.id, role: 'merchant' }).lean();
    const transactions = wallet
        ? await Transaction.find({ wallet: wallet._id }).sort({ createdAt: -1 }).populate('order').lean()
        : [];

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={params.success} error={params.error} info={params.info} />

                <p className="section-title mb-1">Merchant Wallet</p>
                <h2 className="mb-4">Balance: ₦{wallet ? wallet.balance.toLocaleString() : '0'}</h2>

                <div className="card">
                    <div className="card-header">Transaction History</div>
                    <div className="card-body">
                        {transactions.length === 0 ? (
                            <div className="empty-state"><i className="fa-solid fa-receipt"></i><p>No transactions yet.</p></div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table">
                                    <thead>
                                        <tr><th>Date</th><th>Type</th><th>Order</th><th>Amount</th><th>Balance After</th></tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map((t) => {
                                            const order = t.order as unknown as { orderNumber?: string } | null;
                                            return (
                                                <tr key={String(t._id)}>
                                                    <td>{moment(t.createdAt).format('MMM D, h:mm A')}</td>
                                                    <td>{t.type.replace(/_/g, ' ')}</td>
                                                    <td>{order ? order.orderNumber : '—'}</td>
                                                    <td>₦{t.amount.toLocaleString()}</td>
                                                    <td>₦{t.balanceAfter.toLocaleString()}</td>
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
