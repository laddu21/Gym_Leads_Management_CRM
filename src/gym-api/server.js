console.log('Starting server...');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

console.log('Express loaded');

const app = express();
const PORT = process.env.PORT || 5050;
console.log('App created, port:', PORT);

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process, just log
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit the process, just log
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Connect to database
const connectDB = require('./src/config/database');
connectDB().catch((err) => {
    console.error('Database connection failed:', err);
});

// Routes
const authRoutes = require('./src/routes/auth');
const leadsRoutes = require('./src/routes/leads');
const membershipsRoutes = require('./src/routes/memberships');
const trainersRoutes = require('./src/routes/trainers');
const pitchesRoutes = require('./src/routes/pitches');
const reportsRoutes = require('./src/routes/reports');
const attendanceRoutes = require('./src/routes/attendance');
const otpRoutes = require('./src/routes/otp');
const userMembershipsRoutes = require('./src/routes/userMemberships');
const performanceRoutes = require('./src/routes/performance');
const monthlyReportsRoutes = require('./src/routes/monthly-reports');
const configRoutes = require('./src/routes/config');

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/memberships', membershipsRoutes);
app.use('/api/trainers', trainersRoutes);
app.use('/api/pitches', pitchesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/user-memberships', userMembershipsRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/monthly-reports', monthlyReportsRoutes);
app.use('/api/config', configRoutes);

// Lightweight health check (readiness/liveness)
app.get('/api/health', (req, res) => {
    res.status(200).json({ ok: true, uptime: process.uptime(), env: process.env.NODE_ENV || 'development' });
});

// Handle favicon.ico requests
app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // No content response for favicon
});

app.get('/', (req, res) => {
    console.log('Request received');
    res.json({ status: 'ok', message: 'Gym API is running' });
});

console.log('About to listen on port', PORT);
app.listen(PORT, () => {
    console.log(`Gym API listening on port ${PORT}`);

    // Monthly archive feature temporarily disabled (needs implementation)
    // const { checkAndArchive } = require('./utils/monthlyArchive');
    // setTimeout(async () => {
    //     try {
    //         const result = await checkAndArchive();
    //         if (result.success && !result.skipped) {
    //             console.log(`Monthly archive completed: ${result.year}-${result.month} (${result.totalCount} leads)`);
    //         }
    //     } catch (error) {
    //         console.error('Error in monthly archive check:', error);
    //     }
    // }, 5000); // Wait 5 seconds after startup to allow DB connection
}).on('error', (err) => {
    console.error('Server failed to start:', err);
});
