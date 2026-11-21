const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Strict Read-Only connection to Pydah Transport MongoDB
const TRANSPORT_URI = process.env.TRANSPORT_MONGO_URI;

if (!TRANSPORT_URI) {
    console.warn('⚠️ TRANSPORT_MONGO_URI is not defined in .env. Skipping Transport MongoDB connection.');
}

const transportConnection = TRANSPORT_URI ? mongoose.createConnection(TRANSPORT_URI, {
    readPreference: 'secondaryPreferred',
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 3000,
    bufferCommands: false, // Fail fast if transport cluster is disconnected or unreachable
}) : null;

if (transportConnection) {
    transportConnection.on('connected', () => {
        console.log(`✅ Transport MongoDB Connected (Strict Read-Only Mode)`);
    });

    transportConnection.on('error', (err) => {
        console.error(`❌ Transport MongoDB Connection Error: ${err.message}`);
    });
}

// Guard plugin to forbid write operations on any model compiled with this connection
const readOnlyGuardPlugin = (schema) => {
    const blockWrite = function (action) {
        return function (next) {
            const err = new Error(`FORBIDDEN: Write operation '${action}' is prohibited. Transport Database is in strict read-only mode.`);
            if (typeof next === 'function') {
                return next(err);
            }
            throw err;
        };
    };

    schema.pre('save', blockWrite('save'));
    schema.pre('insertMany', blockWrite('insertMany'));
    schema.pre('updateOne', blockWrite('updateOne'));
    schema.pre('updateMany', blockWrite('updateMany'));
    schema.pre('deleteOne', blockWrite('deleteOne'));
    schema.pre('deleteMany', blockWrite('deleteMany'));
    schema.pre('findOneAndDelete', blockWrite('findOneAndDelete'));
    schema.pre('findOneAndRemove', blockWrite('findOneAndRemove'));
    schema.pre('findOneAndUpdate', blockWrite('findOneAndUpdate'));
};

if (transportConnection) {
    transportConnection.plugin(readOnlyGuardPlugin);
}

module.exports = transportConnection;

