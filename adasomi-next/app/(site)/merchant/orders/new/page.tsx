import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { RiderListing } from '@/models/RiderListing';
import { PlatformConfig } from '@/models/PlatformConfig';
import FlashMessage from '@/components/FlashMessage';
import MerchantOrderForm from './MerchantOrderForm';

export const metadata = { title: 'Dispatch New Order' };

export default async function MerchantNewOrderPage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    const user = await requireRole('merchant');
    const params = await searchParams;
    await connectDB();

    const [listings, config] = await Promise.all([
        RiderListing.find({ merchant: user.id, status: 'approved' }).populate('rider').lean(),
        PlatformConfig.getSingleton()
    ]);

    const fleet = listings.map((l) => {
        const rider = l.rider as unknown as { _id: unknown; firstName: string; lastName: string; riderInfo?: { vehicleType?: string } };
        return {
            id: String(rider._id),
            name: `${rider.firstName} ${rider.lastName}`,
            vehicleType: rider.riderInfo?.vehicleType ? rider.riderInfo.vehicleType.replace(/_/g, ' ') : ''
        };
    });

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={params.success} error={params.error} info={params.info} />

                <p className="section-title mb-1">New Dispatch</p>
                <h2 className="mb-4">Create an order</h2>

                <MerchantOrderForm
                    fleet={fleet}
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
