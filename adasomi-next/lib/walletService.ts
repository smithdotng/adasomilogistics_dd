import { Wallet, type WalletRole, type IWallet } from '@/models/Wallet';
import { Transaction, type TransactionType } from '@/models/Transaction';
import type { IOrder } from '@/models/Order';
import type { Types } from 'mongoose';

export async function getOrCreateWallet(owner: Types.ObjectId | string, role: WalletRole): Promise<IWallet> {
    let wallet = await Wallet.findOne({ owner, role });
    if (!wallet) wallet = await Wallet.create({ owner, role, balance: 0 });
    return wallet;
}

export async function getPlatformWallet(): Promise<IWallet> {
    let wallet = await Wallet.findOne({ role: 'platform' });
    if (!wallet) wallet = await Wallet.create({ role: 'platform', balance: 0 });
    return wallet;
}

export async function credit(
    wallet: IWallet,
    amount: number,
    type: TransactionType,
    order: IOrder | null,
    description: string
): Promise<IWallet> {
    wallet.balance = Math.round((wallet.balance + amount) * 100) / 100;
    await wallet.save();
    await Transaction.create({
        wallet: wallet._id,
        order: order ? order._id : undefined,
        type,
        amount,
        balanceAfter: wallet.balance,
        description
    });
    return wallet;
}
