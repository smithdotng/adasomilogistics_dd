import Link from 'next/link';
import FlashMessage from '@/components/FlashMessage';
import Scooter from '@/components/illustrations/Scooter';
import Storefront from '@/components/illustrations/Storefront';
import Parcel from '@/components/illustrations/Parcel';
import RiderBadge from '@/components/illustrations/RiderBadge';

export const metadata = { title: 'How It Works' };

export default async function HowItWorksPage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    const params = await searchParams;

    return (
        <>
            <FlashMessage success={params.success} error={params.error} info={params.info} />

            <section className="hero-peach">
                <div className="container">
                    <div className="row align-items-center">
                        <div className="col-lg-7">
                            <h1>How Adasomi moves an order from click to doorstep.</h1>
                            <p className="lead">
                                One pricing engine, one escrow vault, three kinds of riders and merchants working together in
                                real time. Whether this is your first delivery app or your tenth, here&apos;s everything you
                                need to get going.
                            </p>
                        </div>
                        <div className="col-lg-5 d-none d-lg-block">
                            <Scooter />
                        </div>
                    </div>
                </div>
            </section>

            <main className="page-shell">
                <div className="container">
                    {/* Quick jump nav — helps first-time visitors find their section fast */}
                    <p className="section-title text-center">Find your guide</p>
                    <h2 className="text-center mb-5">Pick the role that matches you</h2>
                    <div className="row g-4 mb-5">
                        <div className="col-md-3 col-6">
                            <a href="#merchants" className="text-decoration-none">
                                <div className="role-card h-100 text-center">
                                    <div className="role-icon mx-auto"><i className="fa-solid fa-store"></i></div>
                                    <h6 className="mb-1">Merchants</h6>
                                    <p className="text-muted small mb-0">Restaurants, food processors, vendors &amp; aggregators</p>
                                </div>
                            </a>
                        </div>
                        <div className="col-md-3 col-6">
                            <a href="#public-users" className="text-decoration-none">
                                <div className="role-card h-100 text-center">
                                    <div className="role-icon mx-auto"><i className="fa-solid fa-user"></i></div>
                                    <h6 className="mb-1">Public Users</h6>
                                    <p className="text-muted small mb-0">Need a one-off pickup and delivery</p>
                                </div>
                            </a>
                        </div>
                        <div className="col-md-3 col-6">
                            <a href="#riders" className="text-decoration-none">
                                <div className="role-card h-100 text-center">
                                    <div className="role-icon mx-auto"><i className="fa-solid fa-motorcycle"></i></div>
                                    <h6 className="mb-1">Riders</h6>
                                    <p className="text-muted small mb-0">Deliver and get paid per trip</p>
                                </div>
                            </a>
                        </div>
                        <div className="col-md-3 col-6">
                            <a href="#helpdesk" className="text-decoration-none">
                                <div className="role-card h-100 text-center">
                                    <div className="role-icon mx-auto"><i className="fa-solid fa-headset"></i></div>
                                    <h6 className="mb-1">Helpdesk</h6>
                                    <p className="text-muted small mb-0">Oversight, disputes &amp; support</p>
                                </div>
                            </a>
                        </div>
                    </div>

                    {/* Merchant guide */}
                    <div id="merchants" className="row g-4 align-items-center mb-5 pt-2">
                        <div className="col-lg-4 d-none d-lg-block">
                            <Storefront />
                        </div>
                        <div className="col-lg-8">
                            <p className="section-title mb-1">For Merchants (Commercial Operators)</p>
                            <h3 className="mb-3">Restaurant owners, food processors, food vendors &amp; produce aggregators</h3>
                            <p className="text-muted">
                                New to Adasomi? Start here — these are the exact steps to go from signing up to your first
                                completed delivery.
                            </p>
                            <div className="accordion" id="merchantAccordion">
                                <div className="accordion-item">
                                    <h2 className="accordion-header">
                                        <button className="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#merchantStep1">
                                            1. Create your business account
                                        </button>
                                    </h2>
                                    <div id="merchantStep1" className="accordion-collapse collapse show" data-bs-parent="#merchantAccordion">
                                        <div className="accordion-body text-muted">
                                            Register and choose <strong>Merchant</strong>. Add your business name, type
                                            (restaurant, food processor, food vendor, or produce aggregator), and address. You
                                            can start dispatching as soon as your account is verified by email — no separate
                                            approval wait.
                                        </div>
                                    </div>
                                </div>
                                <div className="accordion-item">
                                    <h2 className="accordion-header">
                                        <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#merchantStep2">
                                            2. Build your rider fleet
                                        </button>
                                    </h2>
                                    <div id="merchantStep2" className="accordion-collapse collapse" data-bs-parent="#merchantAccordion">
                                        <div className="accordion-body text-muted">
                                            Go to <strong>Riders</strong> in your dashboard. Search for a registered rider by
                                            name or email and add them directly, or wait for riders to send you a verification
                                            request and approve or reject it from there.
                                        </div>
                                    </div>
                                </div>
                                <div className="accordion-item">
                                    <h2 className="accordion-header">
                                        <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#merchantStep3">
                                            3. Dispatch an order
                                        </button>
                                    </h2>
                                    <div id="merchantStep3" className="accordion-collapse collapse" data-bs-parent="#merchantAccordion">
                                        <div className="accordion-body text-muted">
                                            From <strong>Orders → Dispatch New Order</strong>, drop a pickup and drop-off pin on
                                            the map, add recipient details and item value, then choose to{' '}
                                            <strong>broadcast</strong> to your whole verified fleet (first rider to accept gets
                                            it) or <strong>assign</strong> a specific rider directly.
                                        </div>
                                    </div>
                                </div>
                                <div className="accordion-item">
                                    <h2 className="accordion-header">
                                        <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#merchantStep4">
                                            4. Fund escrow &amp; share the codes
                                        </button>
                                    </h2>
                                    <div id="merchantStep4" className="accordion-collapse collapse" data-bs-parent="#merchantAccordion">
                                        <div className="accordion-body text-muted">
                                            Fund escrow for the order total. This generates a 4-digit pickup OTP and a 4-digit
                                            delivery PIN. Give the OTP to whoever hands the order to the rider, and the PIN to
                                            the recipient — the rider needs both to complete the trip and trigger payout.
                                        </div>
                                    </div>
                                </div>
                                <div className="accordion-item">
                                    <h2 className="accordion-header">
                                        <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#merchantStep5">
                                            5. Track it and get paid
                                        </button>
                                    </h2>
                                    <div id="merchantStep5" className="accordion-collapse collapse" data-bs-parent="#merchantAccordion">
                                        <div className="accordion-body text-muted">
                                            Watch the delivery move live on the order&apos;s tracking map. Once the recipient
                                            confirms with the PIN, the item value is released to your wallet automatically —
                                            no manual invoicing. Ran into a problem? Raise a dispute right from the order page.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="my-5" />

                    {/* Public user guide */}
                    <div id="public-users" className="row g-4 align-items-center mb-5 pt-2">
                        <div className="col-lg-8 order-2 order-lg-1">
                            <p className="section-title mb-1">For Public Users</p>
                            <h3 className="mb-3">Sending something? No business account required.</h3>
                            <p className="text-muted">
                                Perfect for a one-off pickup and delivery — a document, a gift, groceries, anything that fits
                                on a bike or in a car.
                            </p>
                            <div className="accordion" id="publicAccordion">
                                <div className="accordion-item">
                                    <h2 className="accordion-header">
                                        <button className="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#publicStep1">
                                            1. Create a free account
                                        </button>
                                    </h2>
                                    <div id="publicStep1" className="accordion-collapse collapse show" data-bs-parent="#publicAccordion">
                                        <div className="accordion-body text-muted">
                                            Register and choose <strong>Public User</strong>. No business details needed — just
                                            your name, phone number and email.
                                        </div>
                                    </div>
                                </div>
                                <div className="accordion-item">
                                    <h2 className="accordion-header">
                                        <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#publicStep2">
                                            2. Request a rider
                                        </button>
                                    </h2>
                                    <div id="publicStep2" className="accordion-collapse collapse" data-bs-parent="#publicAccordion">
                                        <div className="accordion-body text-muted">
                                            From your dashboard, tap <strong>Request a Rider</strong>. Drop a pin for pickup,
                                            then another for drop-off. You&apos;ll see the exact logistics fee before you
                                            confirm anything — no surprises.
                                        </div>
                                    </div>
                                </div>
                                <div className="accordion-item">
                                    <h2 className="accordion-header">
                                        <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#publicStep3">
                                            3. Pay to activate dispatch
                                        </button>
                                    </h2>
                                    <div id="publicStep3" className="accordion-collapse collapse" data-bs-parent="#publicAccordion">
                                        <div className="accordion-body text-muted">
                                            Fund the logistics fee up front — this is held safely in escrow, not paid out to
                                            anyone yet. Your request then broadcasts to nearby verified riders.
                                        </div>
                                    </div>
                                </div>
                                <div className="accordion-item">
                                    <h2 className="accordion-header">
                                        <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#publicStep4">
                                            4. Share your codes &amp; track live
                                        </button>
                                    </h2>
                                    <div id="publicStep4" className="accordion-collapse collapse" data-bs-parent="#publicAccordion">
                                        <div className="accordion-body text-muted">
                                            You&apos;ll get a pickup OTP and a delivery PIN. Give the OTP to the rider when
                                            they collect the item, and make sure the recipient has the PIN ready — that&apos;s
                                            what confirms the delivery is complete. Watch the rider&apos;s live location the
                                            whole way.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-4 order-1 order-lg-2 d-none d-lg-block">
                            <Parcel />
                        </div>
                    </div>

                    <hr className="my-5" />

                    {/* Rider guide */}
                    <div id="riders" className="row g-4 align-items-center mb-4 pt-2">
                        <div className="col-lg-4 d-none d-lg-block">
                            <RiderBadge />
                        </div>
                        <div className="col-lg-8">
                            <p className="section-title mb-1">For Riders</p>
                            <h3 className="mb-3">Get verified, accept deliveries, get paid instantly</h3>
                            <p className="text-muted">
                                You register once, then get verified by any number of merchants — each one adds you to their
                                own fleet.
                            </p>
                        </div>
                    </div>
                    <div className="row g-4 mb-5">
                        <div className="col-md-3 col-6">
                            <div className="role-card h-100">
                                <div className="role-icon"><i className="fa-solid fa-id-card"></i></div>
                                <h6>1. Sign Up</h6>
                                <p className="text-muted small">
                                    Register as a <strong>Rider</strong> and submit your license number, vehicle type
                                    (dispatch bike, bicycle, car or van) and plate number.
                                </p>
                            </div>
                        </div>
                        <div className="col-md-3 col-6">
                            <div className="role-card h-100">
                                <div className="role-icon"><i className="fa-solid fa-paper-plane"></i></div>
                                <h6>2. Get Verified</h6>
                                <p className="text-muted small">
                                    Search for operators under <strong>Verification</strong> and request to join their fleet,
                                    or wait for a merchant to add you directly.
                                </p>
                            </div>
                        </div>
                        <div className="col-md-3 col-6">
                            <div className="role-card h-100">
                                <div className="role-icon"><i className="fa-solid fa-list-check"></i></div>
                                <h6>3. Accept Deliveries</h6>
                                <p className="text-muted small">
                                    Toggle yourself <strong>Available</strong>, then accept broadcast orders or assigned
                                    deliveries from your dashboard.
                                </p>
                            </div>
                        </div>
                        <div className="col-md-3 col-6">
                            <div className="role-card h-100">
                                <div className="role-icon"><i className="fa-solid fa-wallet"></i></div>
                                <h6>4. Get Paid</h6>
                                <p className="text-muted small">
                                    Confirm pickup with the sender&apos;s OTP, then delivery with the recipient&apos;s PIN —
                                    your logistics fee lands in your wallet immediately.
                                </p>
                            </div>
                        </div>
                    </div>

                    <hr className="my-5" />

                    {/* Helpdesk / oversight guide */}
                    <div id="helpdesk" className="row g-4 mb-5 pt-2">
                        <div className="col-12">
                            <p className="section-title mb-1">Oversight &amp; Support</p>
                            <h3 className="mb-3">The Adasomi Logistics Helpdesk</h3>
                            <p className="text-muted mb-4" style={{ maxWidth: 720 }}>
                                Every account on Adasomi is backed by the <strong>Adasomi Logistics Helpdesk</strong> — the
                                team that keeps the platform fair, verified, and running smoothly. If something goes wrong
                                with an order, a rider&apos;s documents, or a payout, this is who steps in.
                            </p>
                            <div className="row g-4">
                                <div className="col-md-3 col-6">
                                    <div className="role-card h-100">
                                        <div className="role-icon"><i className="fa-solid fa-id-badge"></i></div>
                                        <h6>KYC Audit</h6>
                                        <p className="text-muted small">Reviews rider documents and sets verification status.</p>
                                    </div>
                                </div>
                                <div className="col-md-3 col-6">
                                    <div className="role-card h-100">
                                        <div className="role-icon"><i className="fa-solid fa-scale-balanced"></i></div>
                                        <h6>Dispute Resolution</h6>
                                        <p className="text-muted small">Investigates and resolves disputes raised on any order.</p>
                                    </div>
                                </div>
                                <div className="col-md-3 col-6">
                                    <div className="role-card h-100">
                                        <div className="role-icon"><i className="fa-solid fa-sliders"></i></div>
                                        <h6>Pricing &amp; Commission</h6>
                                        <p className="text-muted small">Configures base fees, per-km rates and platform commission.</p>
                                    </div>
                                </div>
                                <div className="col-md-3 col-6">
                                    <div className="role-card h-100">
                                        <div className="role-icon"><i className="fa-solid fa-chart-line"></i></div>
                                        <h6>Platform Oversight</h6>
                                        <p className="text-muted small">Monitors every order, merchant and rider across Adasomi.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="my-5" />

                    <p className="section-title">Pricing engine</p>
                    <h4 className="mb-3">How the delivery fee is calculated</h4>
                    <p className="text-muted" style={{ maxWidth: 720 }}>
                        Every order&apos;s logistics fee is calculated the same transparent way, whether it&apos;s a merchant
                        dispatch or a public request:
                    </p>
                    <div className="pricing-box mb-3">
                        <p className="mb-2"><strong>C_logistics</strong> = Base Fee + (Distance km × Per-KM Rate) + Peak Surcharge</p>
                        <p className="mb-0"><strong>V_total</strong> = V_items + C_logistics</p>
                    </div>
                    <p className="text-muted small mb-5" style={{ maxWidth: 720 }}>
                        In plain terms: you pay a base fee plus a per-kilometre charge for the distance, plus a small
                        surcharge during busy meal-time windows. Merchants add the value of the items being sent on top;
                        public users just pay the logistics fee itself.
                    </p>

                    <p className="section-title">Roles at a glance</p>
                    <div className="table-responsive mb-5">
                        <table className="table">
                            <thead><tr><th>Role</th><th>Key Capabilities</th></tr></thead>
                            <tbody>
                                <tr>
                                    <td>Merchants <span className="text-muted">(Commercial Operators)</span></td>
                                    <td>Restaurant owners, food processors, food vendors &amp; produce aggregators — create merchant accounts, verify &amp; list riders, dispatch orders, fund/bill orders.</td>
                                </tr>
                                <tr><td>Public Users</td><td>Request direct dispatch, select riders, pay logistics fees up front.</td></tr>
                                <tr><td>Riders</td><td>Register independently, submit KYC, get verified, execute deliveries.</td></tr>
                                <tr><td>Adasomi Logistics Helpdesk</td><td>Dispute resolution, KYC audit, commission configuration, platform oversight.</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <p className="section-title">Frequently asked questions</p>
                    <div className="accordion mb-5" id="faqAccordion">
                        <div className="accordion-item">
                            <h2 className="accordion-header">
                                <button className="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#faq1">
                                    I&apos;ve never used a delivery app before — where do I start?
                                </button>
                            </h2>
                            <div id="faq1" className="accordion-collapse collapse show" data-bs-parent="#faqAccordion">
                                <div className="accordion-body text-muted">
                                    Start with <Link href="/register">Create your account</Link> and pick the role that fits
                                    you: <strong>Merchant</strong> if you run a food or produce business, <strong>Rider</strong>{' '}
                                    if you want to deliver, or <strong>Public User</strong> if you just need to send something
                                    once. Every dashboard is guided — you won&apos;t need to know any of the pricing formulas
                                    above to use it.
                                </div>
                            </div>
                        </div>
                        <div className="accordion-item">
                            <h2 className="accordion-header">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq2">
                                    What&apos;s escrow, and why do I have to pay before the rider is even assigned?
                                </button>
                            </h2>
                            <div id="faq2" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                                <div className="accordion-body text-muted">
                                    Escrow means Adasomi holds the payment safely until the delivery is actually confirmed —
                                    it isn&apos;t released to anyone until the recipient enters the delivery PIN. This
                                    protects both sides: the sender knows the money can&apos;t be taken without a completed
                                    delivery, and the rider knows the funds are already secured before they start.
                                </div>
                            </div>
                        </div>
                        <div className="accordion-item">
                            <h2 className="accordion-header">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq3">
                                    I lost or didn&apos;t receive my OTP or PIN. What do I do?
                                </button>
                            </h2>
                            <div id="faq3" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                                <div className="accordion-body text-muted">
                                    Both codes are visible on the order&apos;s detail page any time after escrow is funded —
                                    open the order and scroll to the OTP / PIN card to see them again. If you&apos;re still
                                    stuck, raise a dispute from the order page and the Adasomi Logistics Helpdesk will step
                                    in.
                                </div>
                            </div>
                        </div>
                        <div className="accordion-item">
                            <h2 className="accordion-header">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq4">
                                    Something went wrong with my order — who do I contact?
                                </button>
                            </h2>
                            <div id="faq4" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                                <div className="accordion-body text-muted">
                                    Open the order and use <strong>Raise a Dispute</strong> to describe the issue. This goes
                                    straight to the <strong>Adasomi Logistics Helpdesk</strong>, who can investigate and
                                    resolve it — including releasing or refunding escrow where needed.
                                </div>
                            </div>
                        </div>
                        <div className="accordion-item">
                            <h2 className="accordion-header">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq5">
                                    As a rider, how long does verification take?
                                </button>
                            </h2>
                            <div id="faq5" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                                <div className="accordion-body text-muted">
                                    It depends on the merchant you&apos;ve requested, but most operators review requests
                                    within a day. You can request verification from multiple merchants at once to widen the
                                    pool of deliveries available to you.
                                </div>
                            </div>
                        </div>
                        <div className="accordion-item">
                            <h2 className="accordion-header">
                                <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq6">
                                    Can I change my mind and cancel an order?
                                </button>
                            </h2>
                            <div id="faq6" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                                <div className="accordion-body text-muted">
                                    Yes — any order that hasn&apos;t been picked up yet (awaiting payment, awaiting
                                    assignment, or just assigned) can be cancelled from its detail page. Escrow that was
                                    already funded is refunded automatically. Once a rider has picked the order up, it can no
                                    longer be cancelled — raise a dispute instead if there&apos;s a problem.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-center">
                        <h2>Ready to move something?</h2>
                        <p className="text-muted mb-4">
                            Still have questions? The Adasomi Logistics Helpdesk is always a dispute or support request away.
                        </p>
                        <Link href="/register" className="btn btn-peach btn-lg">Create your account</Link>
                    </div>
                </div>
            </main>
        </>
    );
}
