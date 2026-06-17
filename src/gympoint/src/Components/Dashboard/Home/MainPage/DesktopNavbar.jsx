import React, { useState } from 'react';

const DesktopNavbar = ({
    isDesktopSidebarOpen,
    toggleDesktopSidebar,
    onValidSearch,
    onNavigate,
    title = 'Dashboard'
}) => {
    const [searchValue, setSearchValue] = useState('');

    const handleSearchChange = (e) => {
        const value = e.target.value.replace(/\D/g, ''); // Only allow digits
        if (value.length <= 10) {
            setSearchValue(value);
        }
    };

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter') {
            const trimmed = searchValue.trim();
            if (trimmed && /^\d{10}$/.test(trimmed)) {
                onValidSearch(trimmed);
                setSearchValue('');
            }
        }
    };

    return (
        <div className="hidden md:block w-full bg-white shadow-md border-b border-gray-200">
            <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                {/* Left: Sidebar toggle and title */}
                <div className="flex items-center space-x-2 sm:space-x-4">
                    {/* Sidebar Toggle Button */}
                    <button onClick={toggleDesktopSidebar} className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Toggle sidebar">
                        <svg className={`w-5 h-5 transition-transform duration-300 ${isDesktopSidebarOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-800">{title}</h2>
                </div>

                {/* Center: Search Bar */}
                <div className="flex-1 max-w-[16rem] sm:max-w-[22.4rem] mx-4 sm:mx-8">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by 10-digit phone number"
                            value={searchValue}
                            onChange={handleSearchChange}
                            onKeyDown={handleSearchKeyDown}
                            className="w-full px-3 sm:px-4 py-2 pl-10 sm:pl-12 rounded-lg border border-gray-300 text-sm sm:text-base"
                        />
                        <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Right: User Profile/Actions */}
                <div className="flex items-center space-x-2 sm:space-x-4">
                    {/* Notifications */}
                    <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 0115 0z" />
                        </svg>
                    </button>
                    {/* User Avatar */}
                    <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DesktopNavbar;