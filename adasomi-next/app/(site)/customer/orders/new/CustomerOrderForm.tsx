'use client';

import { createCustomerOrderAction } from '@/actions/customer';
import OrderMap, { type PricingConfigInput } from '@/components/OrderMap';

export default function CustomerOrderForm({ config }: { config: PricingConfigInput }) {
    return (
        <form action={createCustomerOrderAction}>
            <div className="row g-4">
                <div className="col-lg-7">
                    <div className="card mb-4">
                        <div className="card-header">Pickup &amp; Drop-off</div>
                        <div className="card-body">
                            <OrderMap config={config} itemsValue={0} showItemsValueInBreakdown={false} />
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">Recipient &amp; Parcel</div>
                        <div className="card-body">
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label">Recipient Name</label>
                                    <input type="text" className="form-control" name="recipientName" required />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label">Recipient Phone</label>
                                    <input type="text" className="form-control" name="recipientPhone" required />
                                </div>
                                <div className="col-12">
                                    <label className="form-label">What are we sending?</label>
                                    <input type="text" className="form-control" name="itemsDescription" placeholder="e.g. Documents, a small parcel…" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-5">
                    <div className="card" style={{ position: 'sticky', top: 90 }}>
                        <div className="card-header">Logistics Fee Preview</div>
                        <div className="card-body">
                            <p className="text-muted small mb-0">Set the pickup &amp; drop-off pins on the map to see your fee above.</p>
                            <button type="submit" className="btn btn-peach w-100 mt-4">
                                <i className="fa-solid fa-truck-fast me-2"></i>Request Rider
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
}
