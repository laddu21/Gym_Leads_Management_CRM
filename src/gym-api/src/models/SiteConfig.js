const mongoose = require('mongoose');

const siteConfigSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true, index: true },
        value: { type: mongoose.Schema.Types.Mixed, default: null }
    },
    { timestamps: true }
);

module.exports = mongoose.model('SiteConfig', siteConfigSchema);
