const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

async function getOrCreateWallet(owner, role) {
    let wallet = await Wallet.findOne({ owner, role });
    if (!wallet) wallet = await Wallet.create({ owner, role, balance: 0 });
    return wallet;
}

async function getPlatformWallet() {
    let wallet = await Wallet.findOne({ role: 'platform' });
    if (!wallet) wallet = await Wallet.create({ role: 'platform', balance: 0 });
    return wallet;
}

async function credit(wallet, amount, type, order, description) {
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

module.exports = { getOrCreateWallet, getPlatformWallet, credit };
