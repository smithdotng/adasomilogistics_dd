const mongoose = require('mongoose');

/**
 * Safely convert an ID string to MongoDB ObjectId
 * @param {string} id - The ID string to convert
 * @returns {mongoose.Types.ObjectId} MongoDB ObjectId
 */
const toObjectId = (id) => {
    if (!id) return null;
    try {
        return new mongoose.Types.ObjectId(id);
    } catch (error) {
        console.error('Invalid ObjectId:', id);
        return null;
    }
};

/**
 * Safely convert multiple ID strings to MongoDB ObjectIds
 * @param {Array<string>} ids - Array of ID strings to convert
 * @returns {Array<mongoose.Types.ObjectId>} Array of MongoDB ObjectIds
 */
const toObjectIds = (ids) => {
    if (!Array.isArray(ids)) return [];
    return ids.map(id => toObjectId(id)).filter(id => id !== null);
};

module.exports = {
    toObjectId,
    toObjectIds
};