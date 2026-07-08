/**
 * migrate-roles.js
 *
 * One-time data migration to match the new CareShed role naming:
 *   client          -> service_user
 *   operator        -> support_worker
 *   service_provider -> care_provider
 *
 * This updates existing documents in MongoDB so they line up with the
 * renamed fields/values now used throughout the codebase. The app's code
 * has already been updated to expect the NEW names - until this script is
 * run, existing accounts created before this change will have role checks
 * fail (e.g. an existing "operator" user will no longer match
 * role === 'support_worker' and will be redirected to /login).
 *
 * SAFE TO RE-RUN: every step only touches documents still using the old
 * field/value names, so running it twice is a no-op the second time.
 *
 * USAGE:
 *   node migrate-roles.js --dry-run   # shows what would change, writes nothing
 *   node migrate-roles.js             # applies the changes
 *
 * Run this yourself against your database (it reads MONGODB_URI from .env).
 * It is NOT run automatically as part of deployment.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI not found in .env - aborting.');
        process.exit(1);
    }

    console.log(`Connecting to ${process.env.MONGODB_URI.replace(/\/\/.*@/, '//<redacted>@')} ...`);
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    console.log(DRY_RUN ? '--- DRY RUN: no changes will be written ---' : '--- LIVE RUN: changes will be written ---');

    const users = db.collection('users');
    const interactions = db.collection('interactions');
    const careplans = db.collection('careplans');
    const schedules = db.collection('schedules');
    const timesheets = db.collection('timesheets');
    const payments = db.collection('payments');

    async function renameField(collection, oldPath, newPath) {
        const filter = { [oldPath]: { $exists: true } };
        const count = await collection.countDocuments(filter);
        console.log(`  ${collection.collectionName}: ${oldPath} -> ${newPath}  (${count} document(s))`);
        if (count > 0 && !DRY_RUN) {
            await collection.updateMany(filter, { $rename: { [oldPath]: newPath } });
        }
    }

    async function setValue(collection, filter, update, label) {
        const count = await collection.countDocuments(filter);
        console.log(`  ${collection.collectionName}: ${label}  (${count} document(s))`);
        if (count > 0 && !DRY_RUN) {
            await collection.updateMany(filter, { $set: update });
        }
    }

    console.log('\n[1/4] Renaming nested fields on "users" (using old parent names first)...');
    await renameField(users, 'providerInfo.subscription.maxOperators', 'providerInfo.subscription.maxSupportWorkers');
    await renameField(users, 'providerInfo.subscription.maxClients', 'providerInfo.subscription.maxServiceUsers');
    await renameField(users, 'operatorInfo.assignedClients', 'operatorInfo.assignedServiceUsers');
    await renameField(users, 'operatorInfo.maxClients', 'operatorInfo.maxServiceUsers');
    await renameField(users, 'clientInfo.primaryCarer', 'clientInfo.primarySupportWorker');
    await renameField(users, 'clientInfo.secondaryCarers', 'clientInfo.secondarySupportWorkers');
    await renameField(users, 'guardianInfo.clientsMonitored', 'guardianInfo.serviceUsersMonitored');

    console.log('\n[2/4] Renaming top-level fields on "users"...');
    await renameField(users, 'clientInfo', 'serviceUserInfo');
    await renameField(users, 'operatorInfo', 'supportWorkerInfo');
    await renameField(users, 'providerInfo', 'careProviderInfo');
    await renameField(users, 'providerId', 'careProviderId');

    console.log('\n[3/4] Updating role values on "users"...');
    await setValue(users, { role: 'client' }, { role: 'service_user' }, "role: 'client' -> 'service_user'");
    await setValue(users, { role: 'operator' }, { role: 'support_worker' }, "role: 'operator' -> 'support_worker'");
    await setValue(users, { role: 'service_provider' }, { role: 'care_provider' }, "role: 'service_provider' -> 'care_provider'");

    console.log('\n[4/4] Renaming reference fields on related collections...');
    await renameField(interactions, 'clientId', 'serviceUserId');
    await renameField(interactions, 'operatorId', 'supportWorkerId');
    await renameField(interactions, 'providerId', 'careProviderId');

    await renameField(careplans, 'clientId', 'serviceUserId');
    await renameField(careplans, 'providerId', 'careProviderId');
    await renameField(careplans, 'signatures.client', 'signatures.serviceUser');
    await renameField(careplans, 'signatures.provider', 'signatures.careProvider');

    await renameField(schedules, 'clientId', 'serviceUserId');
    await renameField(schedules, 'operatorId', 'supportWorkerId');
    await renameField(schedules, 'providerId', 'careProviderId');

    await renameField(timesheets, 'operatorId', 'supportWorkerId');
    await renameField(timesheets, 'providerId', 'careProviderId');

    await renameField(payments, 'operatorId', 'supportWorkerId');
    await renameField(payments, 'providerId', 'careProviderId');

    console.log(DRY_RUN
        ? '\nDry run complete. Re-run without --dry-run to apply these changes.'
        : '\nMigration complete.');

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
