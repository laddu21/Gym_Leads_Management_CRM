const mongoose = require('mongoose');

const GymSchema = new mongoose.Schema({
    gymName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Store hashed password in production
}, { timestamps: true });

module.exports = mongoose.model('Gym', GymSchema);
