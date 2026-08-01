'use server';

import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { User } from '@/models/User';
import { Dispute } from '@/models/Dispute';
import { PlatformConfig } from '@/models/PlatformConfig';

function err(path: string, message: string): never {
    redirect(`${path}?error=${encodeURIComponent(message)}`);
}
function ok(path: string, message: string): never {
    redirect(`${path}?success=${encodeURIComponent(message)}`);
}

export async function decideKycAction(formData: FormData): Promise<void> {
    await requireRole('admin');
    await connectDB();
    const riderId = String(formData.get('riderId') || '');
    const kycStatus = String(formData.get('kycStatus') || '');

    try {
        await User.findByIdAndUpdate(riderId, { 'riderInfo.kycStatus': kycStatus });
        ok('/admin/riders', 'KYC status updated.');
    } catch (e) {
        err('/admin/riders', `Could not update KYC status: ${(e as Error).message}`);
    }
}

export async function resolveDisputeAction(formData: FormData): Promise<void> {
    const user = await requireRole('admin');
    await connectDB();
    const disputeId = String(formData.get('disputeId') || '');
    const decision = String(formData.get('decision') || '');
    const resolutionNotes = String(formData.get('resolutionNotes') || '');

    const dispute = await Dispute.findById(disputeId);
    if (!dispute) err('/admin/disputes', 'Dispute not found.');

    try {
        dispute.status = decision === 'resolve' ? 'resolved' : 'rejected';
        dispute.resolutionNotes = resolutionNotes;
        dispute.resolvedBy = user.id as unknown as typeof dispute.resolvedBy;
        dispute.resolvedAt = new Date();
        await dispute.save();
        ok('/admin/disputes', 'Dispute updated.');
    } catch (e) {
        err('/admin/disputes', `Could not update dispute: ${(e as Error).message}`);
    }
}

export async function updateConfigAction(formData: FormData): Promise<void> {
    const user = await requireRole('admin');
    await connectDB();

    try {
        const baseFee = parseFloat(String(formData.get('baseFee') || ''));
        const perKmRate = parseFloat(String(formData.get('perKmRate') || ''));
        const peakSurcharge = parseFloat(String(formData.get('peakSurcharge') || ''));
        const platformCommissionRate = parseFloat(String(formData.get('platformCommissionRate') || ''));

        const config = await PlatformConfig.getSingleton();
        config.baseFee = baseFee;
        config.perKmRate = perKmRate;
        config.peakSurcharge = peakSurcharge;
        config.platformCommissionRate = platformCommissionRate;
        config.updatedBy = user.id as unknown as typeof config.updatedBy;
        await config.save();
        ok('/admin/config', 'Platform configuration updated.');
    } catch (e) {
        err('/admin/config', `Could not update configuration: ${(e as Error).message}`);
    }
}
