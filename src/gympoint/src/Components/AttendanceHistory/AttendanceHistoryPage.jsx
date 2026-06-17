import React, { useEffect, useState } from 'react';
import { attendanceService } from '../../services/attendanceService';

const AttendanceHistoryPage = () => {
    const [attendanceHistory, setAttendanceHistory] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadAttendanceHistory = async () => {
            try {
                setLoading(true);
                const history = await attendanceService.listHistory();
                setAttendanceHistory(history || {});
            } catch (err) {
                setError(err.message || 'Failed to load attendance history');
            } finally {
                setLoading(false);
            }
        };
        loadAttendanceHistory();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg">Loading attendance history...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-red-500 text-lg">{error}</div>
            </div>
        );
    }

    const historyEntries = Object.entries(attendanceHistory).flatMap(([dateString, entries]) =>
        entries.map(entry => ({ ...entry, date: dateString }))
    );

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-3xl font-bold mb-6">Attendance History</h1>
            {historyEntries.length === 0 ? (
                <div className="text-center text-gray-500">No attendance history available.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-300">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="px-4 py-2 border">Date</th>
                                <th className="px-4 py-2 border">Name</th>
                                <th className="px-4 py-2 border">Phone</th>
                                <th className="px-4 py-2 border">Check-in Time</th>
                                <th className="px-4 py-2 border">Check-out Time</th>
                                <th className="px-4 py-2 border">Total Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historyEntries.map((entry, index) => (
                                <tr key={index} className="border-b">
                                    <td className="px-4 py-2 border">{entry.date}</td>
                                    <td className="px-4 py-2 border">{entry.name}</td>
                                    <td className="px-4 py-2 border">{entry.phone}</td>
                                    <td className="px-4 py-2 border">{entry.checkinTime}</td>
                                    <td className="px-4 py-2 border">{entry.checkoutTime || 'N/A'}</td>
                                    <td className="px-4 py-2 border">{entry.totalCount || 1}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AttendanceHistoryPage;