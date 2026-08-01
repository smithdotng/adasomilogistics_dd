'use client';

import { useState } from 'react';
import { createOrderAction } from '@/actions/merchant';
import OrderMap, { type PricingConfigInput } from '@/components/OrderMap';

interface FleetRider {
    id: string;
    name: string;
    vehicleType: string;
}

export default function MerchantOrderForm({ fleet, config }: { fleet: FleetRider[]; config: PricingConfigInput }) {
    const [dispatchMode, setDispatchMode] = useState<'broadcast' | 'manual'>('broadcast');
    const [itemsValue, setItemsValue] = useState(0);

    return (
        <form action={createOrderAction}>
            <div className="row g-4">
                <div className="col-lg-7">
                    <div className="card mb-4">
                        <div className="card-header">Pickup &amp; Drop-off</div>
                        <div className="card-body">
                            <OrderMap config={config} itemsValue={itemsValue} showItemsValueInBreakdown />
                        </div>
                    </div>

                    <div className="card mb-4">
                        <div className="card-header">Order &amp; Recipient Details</div>
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
                                <div className="col-md-8">
                                    <label className="form-label">Items Description</label>
                                    <input type="text" className="form-control" name="itemsDescription" placeholder="e.g. 3x Jollof rice packs" />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label">Item Value (₦)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="form-control"
                                        name="itemsValue"
                                        value={itemsValue}
                                        onChange={(e) => setItemsValue(parseFloat(e.target.value) || 0)}
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">Dispatch Mode</div>
                        <div className="card-body">
                            <div className="form-check mb-2">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="dispatchMode"
                                    id="mode-broadcast"
                                    value="broadcast"
                                    checked={dispatchMode === 'broadcast'}
                                    onChange={() => setDispatchMode('broadcast')}
                                />
                                <label className="form-check-label" htmlFor="mode-broadcast">
                                    Broadcast to entire verified fleet (first-come, first-served)
                                </label>
                            </div>
                            <div className="form-check mb-3">
                                <input
                                    className="form-check-input"
                                    type="radio"
                                    name="dispatchMode"
                                    id="mode-manual"
                                    value="manual"
                                    checked={dispatchMode === 'manual'}
                                    onChange={() => setDispatchMode('manual')}
                                />
                                <label className="form-check-label" htmlFor="mode-manual">
                                    Assign directly to a specific rider
                                </label>
                            </div>
                            <select
                                className={`form-select ${dispatchMode === 'manual' ? '' : 'd-none'}`}
                                id="assignedRiderId"
                                name="assignedRiderId"
                            >
                                <option value="">Select a verified rider…</option>
                                {fleet.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name} ({r.vehicleType})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="col-lg-5">
                    <div className="card" style={{ position: 'sticky', top: 90 }}>
                        <div className="card-header">Pricing Preview</div>
                        <div className="card-body">
                            <p className="text-muted small mb-0">
                                Set the pickup &amp; drop-off points on the map to see the live estimate above.
                            </p>
                            <button type="submit" className="btn btn-peach w-100 mt-4">
                                <i className="fa-solid fa-truck-fast me-2"></i>Create Order
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
}
