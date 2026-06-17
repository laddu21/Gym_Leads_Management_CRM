
// This route is deprecated. Use /api/auth for OTP endpoints.
const express = require('express');
const router = express.Router();

router.use((req, res) => {
  res.status(410).json({ error: 'This endpoint is deprecated. Use /api/auth instead.' });
});

module.exports = router;
