import { useMemo, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import MembershipsPage from './features/memberships/MembershipsPage.jsx';
import TrainersPage from './features/trainers/TrainersPage.jsx';
import PitchesPage from './features/pitches/PitchesPage.jsx';
import ReportsPage from './features/reports/ReportsPage.jsx';

import PerformancePage from './features/performance/PerformancePage.jsx';
import './styles/app.css';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5050').replace(/\/$/, '');

const viewRegistry = {
    memberships: {
        label: 'Memberships',
        description: 'Manage subscription plans and pricing',
        component: MembershipsPage
    },
    performance: {
        label: 'Performance',
        description: 'View gym performance analytics',
        component: PerformancePage
    },
    trainers: {
        label: 'Trainers',
        description: 'Keep the team directory up to date',
        component: TrainersPage
    },
    // pitches: {
    //     label: 'Recorded Pitches',
    //     description: 'Track conversations with prospects',
    //     component: PitchesPage
    // },
    reports: {
        label: 'Reports',
        description: 'Review key performance metrics',
        component: ReportsPage
    }
};

function App() {
    const [activeView, setActiveView] = useState('memberships');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [searchedMembership, setSearchedMembership] = useState(null);

    const ActiveComponent = useMemo(
        () => viewRegistry[activeView]?.component ?? MembershipsPage,
        [activeView]
    );

    const viewMeta = viewRegistry[activeView] ?? viewRegistry.memberships;

    const handleSelectView = (view) => {
        setActiveView(view);
        setIsMobileMenuOpen(false); // Close menu on selection
        setSearchedMembership(null); // Clear search on view change
    };

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    const handleSearch = async (phone) => {
        if (!phone.trim()) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/user-memberships?phone=${encodeURIComponent(phone)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                setSearchedMembership(data[0]); // Assuming first match
                setActiveView('memberships'); // Switch to memberships view to show details
            } else {
                alert('No membership found for this phone number.');
                setSearchedMembership(null);
            }
        } catch (error) {
            console.error('Error searching membership:', error);
            alert('Error searching membership.');
        }
    };

    return (
        <div className="app-shell">
            <Sidebar
                activeView={activeView}
                onSelectView={handleSelectView}
                entries={viewRegistry}
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
            />
            <main className="app-main">
                <TopBar
                    title={viewMeta.label}
                    subtitle={viewMeta.description}
                    onToggleMenu={toggleMobileMenu}
                    isMenuOpen={isMobileMenuOpen}
                    onSearch={handleSearch}
                />
                <section className="app-content">
                    <ActiveComponent />
                </section>
            </main>
        </div>
    );
}

export default App;
