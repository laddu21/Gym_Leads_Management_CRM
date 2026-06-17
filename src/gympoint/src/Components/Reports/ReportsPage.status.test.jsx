import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import ReportsPage from './ReportsPage';

// Mock services used by ReportsPage
jest.mock('../../services/leadsService', () => ({
    leadsService: {
        list: jest.fn(),
    },
}));

jest.mock('../../services/monthlyReportsService', () => ({
    monthlyReportsService: {
        getNewMembers: jest.fn(),
        getTrialAttended: jest.fn(),
    },
}));

jest.mock('../../services/userMembershipsService', () => ({
    userMembershipsService: {
        list: jest.fn(),
    },
}));

const { leadsService } = require('../../services/leadsService');
const { monthlyReportsService } = require('../../services/monthlyReportsService');
const { userMembershipsService } = require('../../services/userMembershipsService');

describe('ReportsPage - New Members (Month) status', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Force desktop viewport for predictable pagination
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    });

    test('shows Trial from MyLeads even if API provides Converted for same phone', async () => {
        const now = new Date();
        const iso = now.toISOString();

        // MyLeads returns a Trial lead (authoritative status)
        leadsService.list.mockResolvedValueOnce([
            {
                id: 'lead-1',
                name: 'Trial User',
                phone: '9876543210',
                status: 'Trial',
                createdAt: iso,
                // no membership fields for a trial lead
            },
        ]);

        // API new members returns a Converted item for the same phone
        monthlyReportsService.getNewMembers.mockResolvedValueOnce({
            data: [
                {
                    id: 'api-1',
                    name: 'Trial User',
                    phone: '9876543210',
                    status: 'Converted',
                    membership: {
                        planLabel: 'Monthly',
                        amount: 999,
                        startDate: iso,
                        endDate: iso,
                    },
                    createdAt: iso,
                },
            ],
            totalCount: 1,
            totalPages: 1,
        });

        // Trial attended not used in this assertion but must be mocked
        monthlyReportsService.getTrialAttended.mockResolvedValueOnce({ data: [], totalCount: 0, totalPages: 1 });

        // No user-memberships fallback needed
        userMembershipsService.list.mockResolvedValueOnce([]);

        render(<ReportsPage />);

        // Wait for the Trial lead to appear in the New Members (Month) table
        const row = await waitFor(async () => {
            const nameCell = await screen.findByText('Trial User');
            // Row is the closest tr ancestor
            return nameCell.closest('tr');
        });

        expect(row).toBeTruthy();

        // Within that row, the Status cell should show Trial (not Converted)
        const statusCell = within(row).getByText(/Trial/i);
        expect(statusCell).toBeInTheDocument();
        expect(within(row).queryByText('Converted')).toBeNull();
    });
});
