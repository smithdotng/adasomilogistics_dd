import Image from 'next/image';
import Link from 'next/link';
import { registerAction } from '@/actions/auth';
import FlashMessage from '@/components/FlashMessage';
import Scooter from '@/components/illustrations/Scooter';
import RoleFieldsToggle from './RoleFieldsToggle';

export const metadata = { title: 'Create Account' };

export default async function RegisterPage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    const params = await searchParams;

    return (
        <div className="auth-wrapper">
            <div className="container">
                <div className="auth-card" style={{ maxWidth: 1100 }}>
                    <div className="row g-0">
                        <div className="col-lg-5">
                            <div className="auth-left">
                                <h2>Join the Adasomi network</h2>
                                <p>
                                    Whichever seat you take — merchant, rider, or everyday sender — you&apos;re plugged into
                                    one escrow-secured dispatch engine.
                                </p>
                                <ul className="feature-list">
                                    <li>
                                        <i className="fa-solid fa-store"></i>
                                        <span>Merchants (restaurants, food processors, food vendors &amp; produce aggregators) manage a verified fleet</span>
                                    </li>
                                    <li><i className="fa-solid fa-motorcycle"></i><span>Riders get verified &amp; get paid fast</span></li>
                                    <li><i className="fa-solid fa-user"></i><span>Public users dispatch on demand</span></li>
                                </ul>
                                <div className="auth-illust">
                                    <Scooter />
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-7">
                            <div className="auth-right">
                                <div className="text-center mb-4">
                                    <Image src="/images/logo.png" alt="Adasomi Logistics" width={160} height={64} className="brand-logo mb-2" />
                                    <p className="text-muted">Create your account</p>
                                </div>

                                <FlashMessage success={params.success} error={params.error} info={params.info} />

                                <form action={registerAction} id="registerForm">
                                    <RoleFieldsToggle />

                                    <div className="row g-3">
                                        <div className="col-md-6">
                                            <label className="form-label">First Name</label>
                                            <input type="text" className="form-control" name="firstName" required />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">Last Name</label>
                                            <input type="text" className="form-control" name="lastName" required />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">Email Address</label>
                                            <input type="email" className="form-control" name="email" required />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">Phone Number</label>
                                            <input type="text" className="form-control" name="phone" required />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">Password</label>
                                            <input type="password" className="form-control" name="password" required minLength={8} />
                                            <div className="form-text">At least 8 characters.</div>
                                        </div>
                                    </div>

                                    <div id="merchant-fields" className="mt-4">
                                        <p className="section-title">Business details</p>
                                        <div className="row g-3">
                                            <div className="col-md-6">
                                                <label className="form-label">Business Name</label>
                                                <input type="text" className="form-control" name="businessName" />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label">Business Type</label>
                                                <select className="form-select" name="businessType">
                                                    <option value="food_processor">Food Processor</option>
                                                    <option value="food_vendor">Food Vendor</option>
                                                    <option value="restaurant">Restaurant</option>
                                                    <option value="produce_aggregator">Produce Aggregator</option>
                                                </select>
                                            </div>
                                            <div className="col-12">
                                                <label className="form-label">Business Address</label>
                                                <input type="text" className="form-control" name="address" />
                                            </div>
                                        </div>
                                    </div>

                                    <div id="rider-fields" className="mt-4 d-none">
                                        <p className="section-title">KYC &amp; vehicle details</p>
                                        <div className="row g-3">
                                            <div className="col-md-6">
                                                <label className="form-label">Driver&apos;s License Number</label>
                                                <input type="text" className="form-control" name="licenseNumber" />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label">Vehicle Type</label>
                                                <select className="form-select" name="vehicleType">
                                                    <option value="dispatch_bike">Dispatch Bike</option>
                                                    <option value="bicycle">Bicycle</option>
                                                    <option value="car">Car</option>
                                                    <option value="van">Van</option>
                                                </select>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label">Vehicle Plate Number</label>
                                                <input type="text" className="form-control" name="vehiclePlate" />
                                            </div>
                                            <div className="col-12">
                                                <label className="form-label">Additional KYC Notes</label>
                                                <textarea className="form-control" name="kycNotes" rows={2} placeholder="e.g. document reference numbers"></textarea>
                                            </div>
                                        </div>
                                    </div>

                                    <button type="submit" className="btn btn-peach w-100 mt-4">
                                        <i className="fa-solid fa-user-plus me-2"></i>Create Account
                                    </button>
                                </form>

                                <div className="text-center mt-4 text-muted">
                                    Already have an account? <Link href="/login">Sign in</Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
