import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { PlatformConfig } from '@/models/PlatformConfig';
import FlashMessage from '@/components/FlashMessage';
import CustomerOrderForm from './CustomerOrderForm';

export const metadata = { title: 'Request a Rider' };

export default async function CustomerNewOrderPage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    await requireRole('public_user');
    const params = await searchParams;
    await connectDB();

    const config = await PlatformConfig.getSingleton();

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={params.success} error={params.error} info={params.info} />

                <p className="section-title mb-1">Direct Dispatch</p>
                <h2 className="mb-4">Request a rider</h2>

                <CustomerOrderForm
                    config={{
                        baseFee: config.baseFee,
                        perKmRate: config.perKmRate,
                        peakSurcharge: config.peakSurcharge,
                        peakWindows: config.peakWindows
                    }}
                />
            </div>
        </main>
    );
}
