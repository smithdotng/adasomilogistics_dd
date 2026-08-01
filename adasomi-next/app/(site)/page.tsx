import Link from 'next/link';
import FlashMessage from '@/components/FlashMessage';
import Scooter from '@/components/illustrations/Scooter';
import Storefront from '@/components/illustrations/Storefront';
import Parcel from '@/components/illustrations/Parcel';
import RiderBadge from '@/components/illustrations/RiderBadge';

export const metadata = { title: 'Home' };

export default async function HomePage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    const params = await searchParams;

    return (
        <>
            <FlashMessage success={params.success} error={params.error} info={params.info} />

            <section className="hero-peach">
                <div className="container position-relative">
                    <div className="row align-items-center">
                        <div className="col-lg-7">
                            <h1>Point-to-point dispatch for food businesses and everyday deliveries.</h1>
                            <p className="lead">
                                Adasomi connects commercial operators — restaurant owners, food processors, food vendors and
                                produce aggregators — with verified rider fleets and the public, in one escrow-secured
                                logistics engine from kitchen to doorstep.
                            </p>
                            <div className="d-flex flex-wrap gap-3 mt-4">
                                <Link href="/register" className="btn btn-peach btn-lg">Get Started Free</Link>
                                <Link href="/how-it-works" className="btn btn-outline-light btn-lg">See How It Works</Link>
                            </div>
                        </div>
                        <div className="col-lg-5 d-none d-lg-block">
                            <Scooter />
                        </div>
                    </div>
                </div>
            </section>

            <section className="page-shell">
                <div className="container">
                    <p className="section-title text-center">Built for the whole ecosystem</p>
                    <h2 className="text-center mb-5">One platform, three kinds of dispatch</h2>
                    <div className="row g-4">
                        <div className="col-md-4">
                            <div className="role-card">
                                <Storefront />
                                <div className="role-card-body">
                                    <div className="role-icon"><i className="fa-solid fa-store"></i></div>
                                    <h5>Merchants (Commercial Operators)</h5>
                                    <p className="text-muted mb-2">Any food or produce business that needs its own dispatch fleet — specifically:</p>
                                    <ul className="text-muted small mb-0 ps-3">
                                        <li><strong>Restaurant owners</strong> dispatching customer orders</li>
                                        <li><strong>Food processors</strong> moving bulk or packaged goods</li>
                                        <li><strong>Food vendors</strong> serving walk-in &amp; online orders</li>
                                        <li><strong>Produce aggregators</strong> distributing fresh stock</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="role-card">
                                <Parcel />
                                <div className="role-card-body">
                                    <div className="role-icon"><i className="fa-solid fa-user"></i></div>
                                    <h5>Public Users</h5>
                                    <p className="text-muted mb-0">
                                        Drop a pickup and drop-off pin, see the logistics fee instantly, and get matched with
                                        an available verified rider nearby.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="role-card">
                                <RiderBadge />
                                <div className="role-card-body">
                                    <div className="role-icon"><i className="fa-solid fa-motorcycle"></i></div>
                                    <h5>Riders / Fleets</h5>
                                    <p className="text-muted mb-0">
                                        Register independently, submit KYC and vehicle details, then get verified by one or
                                        more operators and start earning from your wallet on every completed trip.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="page-shell" style={{ background: 'var(--thm-bg-soft)' }}>
                <div className="container">
                    <p className="section-title text-center">Order dispatch &amp; dynamic pricing</p>
                    <h2 className="text-center mb-5">From order to escrow-secured payout</h2>
                    <div className="row g-3">
                        <div className="col-6 col-lg">
                            <div className="flow-step">
                                <div className="flow-number">1</div>
                                <h6>Order Created</h6>
                                <p className="text-muted small">Items + destination, or a public pickup/drop-off pin.</p>
                            </div>
                        </div>
                        <div className="col-6 col-lg">
                            <div className="flow-step">
                                <div className="flow-number">2</div>
                                <h6>Rider Assigned</h6>
                                <p className="text-muted small">Manual pick or broadcast, first-come first-served.</p>
                            </div>
                        </div>
                        <div className="col-6 col-lg">
                            <div className="flow-step">
                                <div className="flow-number">3</div>
                                <h6>Escrow Funded</h6>
                                <p className="text-muted small">Gross value held safely in the Adasomi vault.</p>
                            </div>
                        </div>
                        <div className="col-6 col-lg">
                            <div className="flow-step">
                                <div className="flow-number">4</div>
                                <h6>OTP &amp; PIN</h6>
                                <p className="text-muted small">Pickup verified by OTP, delivery confirmed by PIN.</p>
                            </div>
                        </div>
                        <div className="col-6 col-lg">
                            <div className="flow-step">
                                <div className="flow-number">5</div>
                                <h6>Payout Settled</h6>
                                <p className="text-muted small">Item value to merchant, logistics fee to rider.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="page-shell">
                <div className="container text-center">
                    <h2>Ready to move something?</h2>
                    <p className="text-muted mb-4">Join as a commercial operator, an independent rider, or simply request a delivery.</p>
                    <Link href="/register" className="btn btn-peach btn-lg">Create your free account</Link>
                </div>
            </section>
        </>
    );
}
