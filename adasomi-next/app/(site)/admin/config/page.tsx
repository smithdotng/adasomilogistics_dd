import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { PlatformConfig } from '@/models/PlatformConfig';
import FlashMessage from '@/components/FlashMessage';
import { updateConfigAction } from '@/actions/admin';

export const metadata = { title: 'Platform Configuration' };

export default async function AdminConfigPage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    await requireRole('admin');
    const params = await searchParams;
    await connectDB();

    const config = await PlatformConfig.getSingleton();

    return (
        <main className="page-shell">
            <div className="container">
                <FlashMessage success={params.success} error={params.error} info={params.info} />

                <p className="section-title mb-1">Pricing Engine</p>
                <h2 className="mb-4">Platform Configuration</h2>

                <div className="row">
                    <div className="col-lg-7">
                        <div className="card">
                            <div className="card-header">Commission &amp; Fee Settings</div>
                            <div className="card-body">
                                <form action={updateConfigAction}>
                                    <div className="row g-3">
                                        <div className="col-md-6">
                                            <label className="form-label">Base Fee (₦)</label>
                                            <input type="number" step="0.01" className="form-control" name="baseFee" defaultValue={config.baseFee} required />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">Per-KM Rate (₦)</label>
                                            <input type="number" step="0.01" className="form-control" name="perKmRate" defaultValue={config.perKmRate} required />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">Peak Surcharge (₦)</label>
                                            <input type="number" step="0.01" className="form-control" name="peakSurcharge" defaultValue={config.peakSurcharge} required />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">Platform Commission Rate</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="1"
                                                className="form-control"
                                                name="platformCommissionRate"
                                                defaultValue={config.platformCommissionRate}
                                                required
                                            />
                                            <div className="form-text">e.g. 0.15 = 15% of the logistics fee</div>
                                        </div>
                                    </div>
                                    <button type="submit" className="btn btn-peach mt-4">
                                        <i className="fa-solid fa-floppy-disk me-2"></i>Save Configuration
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                    <div className="col-lg-5">
                        <div className="card">
                            <div className="card-header">Peak Windows (meal-time surcharge)</div>
                            <div className="card-body">
                                <ul className="list-unstyled mb-0">
                                    {config.peakWindows.map((w, idx) => (
                                        <li className="mb-2" key={idx}>
                                            <i className="fa-solid fa-clock me-2 text-muted"></i>{w.startHour}:00 – {w.endHour}:00
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-muted small mt-3 mb-0">
                                    Peak windows are fixed for this prototype; extend the PlatformConfig model to make them editable.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
