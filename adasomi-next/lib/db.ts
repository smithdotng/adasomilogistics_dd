import mongoose from 'mongoose';

// Next.js/Vercel bundles each route/page independently, so a route that only
// imports e.g. Order but calls .populate('assignedRider', ... ref: 'User')
// can throw "MissingSchemaError: Schema hasn't been registered for model User"
// if nothing else in that bundle happened to import the User model first.
// Import every model here as a side effect so connectDB() always registers
// the full schema set, regardless of which route triggers the connection.
import '@/models/User';
import '@/models/Order';
import '@/models/RiderListing';
import '@/models/PlatformConfig';
import '@/models/Dispute';
import '@/models/Transaction';
import '@/models/Wallet';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/adasomi';

// Next.js reuses modules across hot-reloads (dev) and serverless invocations
// can run concurrently, so cache the connection promise on the global object
// to avoid opening a new connection per request.
type MongooseCache = {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
};

declare global {
    // eslint-disable-next-line no-var
    var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache || { conn: null, promise: null };
global._mongooseCache = cache;

export async function connectDB() {
    if (cache.conn) return cache.conn;

    if (!cache.promise) {
        cache.promise = mongoose.connect(MONGODB_URI).then((m) => m);
    }

    try {
        cache.conn = await cache.promise;
    } catch (err) {
        cache.promise = null;
        throw err;
    }

    return cache.conn;
}
