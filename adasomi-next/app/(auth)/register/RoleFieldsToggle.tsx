'use client';

import { useState } from 'react';

type Role = 'merchant' | 'rider' | 'public_user';

export default function RoleFieldsToggle() {
    const [role, setRole] = useState<Role>('merchant');

    return (
        <>
            <label className="form-label d-block">I am registering as</label>
            <div className="btn-group w-100 mb-4" role="group">
                <input
                    type="radio"
                    className="btn-check"
                    name="role"
                    id="role-merchant"
                    value="merchant"
                    checked={role === 'merchant'}
                    onChange={() => setRole('merchant')}
                />
                <label className="btn btn-outline-peach" htmlFor="role-merchant">
                    <i className="fa-solid fa-store me-1"></i>Merchant
                </label>

                <input
                    type="radio"
                    className="btn-check"
                    name="role"
                    id="role-rider"
                    value="rider"
                    checked={role === 'rider'}
                    onChange={() => setRole('rider')}
                />
                <label className="btn btn-outline-peach" htmlFor="role-rider">
                    <i className="fa-solid fa-motorcycle me-1"></i>Rider
                </label>

                <input
                    type="radio"
                    className="btn-check"
                    name="role"
                    id="role-public"
                    value="public_user"
                    checked={role === 'public_user'}
                    onChange={() => setRole('public_user')}
                />
                <label className="btn btn-outline-peach" htmlFor="role-public">
                    <i className="fa-solid fa-user me-1"></i>Public User
                </label>
            </div>

            {role === 'merchant' && (
                <p className="text-muted small mb-4">
                    A <strong>Merchant</strong> account is for any commercial operator — a <strong>restaurant owner</strong>,{' '}
                    <strong>food processor</strong>, <strong>food vendor</strong>, or <strong>produce aggregator</strong> — that
                    wants to onboard and dispatch its own verified rider fleet.
                </p>
            )}
            {role === 'rider' && (
                <p className="text-muted small mb-4">
                    A <strong>Rider</strong> account is for independent delivery riders who get verified by one or more
                    merchants and earn payouts per completed trip.
                </p>
            )}
            {role === 'public_user' && (
                <p className="text-muted small mb-4">
                    A <strong>Public User</strong> account is for anyone who just needs a one-off pickup and delivery, no
                    business account required.
                </p>
            )}

            <style jsx global>{`
                #merchant-fields {
                    display: ${role === 'merchant' ? 'block' : 'none'};
                }
                #rider-fields {
                    display: ${role === 'rider' ? 'block' : 'none'};
                }
            `}</style>
        </>
    );
}
