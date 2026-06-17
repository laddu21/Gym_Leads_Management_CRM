import React from 'react';

const Sidebar = ({
    isDesktopSidebarOpen,
    isMobileMenuOpen,
    isDashboardDropdownOpen,
    toggleDashboardDropdown,
    isEmployeesDropdownOpen,
    toggleEmployeesDropdown,
    onNavigate,
    activeView = 'dashboard',
    gymName,
    onLogout
}) => {
    const membershipActive = activeView === 'memberships';
    const membersActive = activeView === 'members-attendance';
    const dashboardActive = activeView === 'dashboard' || activeView === 'performance' || activeView === 'leads';
    const performanceActive = activeView === 'performance';
    const employeesActive = activeView === 'employees';
    const leadsActive = activeView === 'leads';
    const reportsActive = activeView === 'reports';

    return (
        <div className={`${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex bg-gray-800 shadow-xl transition-all duration-300 ${isDesktopSidebarOpen ? 'md:w-[20%]' : 'md:w-0'} overflow-hidden fixed md:relative z-40 md:z-auto h-full`}>
            <div className="flex flex-col w-full min-w-[240px]">
                {/* Sidebar Header */}
                <div className="p-6 border-b border-gray-700">
                    <h1 className="text-white text-2xl font-bold mb-2">
                        {gymName ? (
                            <span>{gymName}</span>
                        ) : (
                            <span><i>RISE</i> by GymPoint</span>
                        )}
                    </h1>
                    <p className="text-gray-300 text-md text-center">The Fitness Studio</p>
                </div>

                {/* Navigation Menu */}
                <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
                    {/* Dashboard Dropdown */}
                    <div className="space-y-1">
                        <button
                            onClick={toggleDashboardDropdown}
                            className={`w-full flex items-center justify-between ${dashboardActive ? 'bg-gray-700 text-white' : 'text-white'} hover:bg-gray-700 px-4 py-3 rounded-lg transition-colors text-left`}
                        >
                            <div className="flex items-center">
                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2-2z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3H8V5z" />
                                </svg>
                                Dashboard
                            </div>
                            <svg
                                className={`w-4 h-4 transition-transform duration-200 ${isDashboardDropdownOpen ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {/* Dashboard Dropdown Content */}
                        {isDashboardDropdownOpen && (
                            <div className="ml-8 space-y-1">
                                <button
                                    onClick={() => onNavigate?.('dashboard')}
                                    className={`w-full flex items-center ${activeView === 'dashboard' ? 'text-white bg-gray-600' : 'text-gray-300'} hover:text-white hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors text-left text-sm`}
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11l2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6" />
                                    </svg>
                                    Home
                                </button>

                                <button
                                    onClick={() => onNavigate?.('performance')}
                                    className={`w-full flex items-center ${performanceActive ? 'text-white bg-gray-600' : 'text-gray-300'} hover:text-white hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors text-left text-sm`}
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
                                    </svg>
                                    My Performance
                                </button>

                                <button
                                    onClick={() => onNavigate?.('leads')}
                                    className={`w-full flex items-center ${leadsActive ? 'text-white bg-gray-600' : 'text-gray-300'} hover:text-white hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors text-left text-sm`}
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                    </svg>
                                    My Leads
                                </button>
                            </div>
                        )}
                    </div>


                    <button
                        onClick={() => onNavigate?.('members-attendance')}
                        className={`w-full flex items-center ${membersActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-white'} hover:bg-gray-700 px-4 py-3 rounded-lg transition-colors text-left`}
                    >
                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                        Members
                    </button>


                    <button
                        onClick={() => onNavigate?.('memberships')}
                        className={`w-full flex items-center ${membershipActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-white'} hover:bg-gray-700 px-4 py-3 rounded-lg transition-colors text-left`}
                    >
                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0V8a2 2 0 01-2 2H8a2 2 0 01-2-2V6m8 0H8m0 0V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6v2a2 2 0 002 2h4a2 2 0 002-2V6" />
                        </svg>
                        Memberships
                    </button>

                    {/* My Employees Dropdown */}
                    <div className="space-y-1">
                        <button
                            onClick={toggleEmployeesDropdown}
                            className={`w-full flex items-center justify-between ${employeesActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-white'} hover:bg-gray-700 px-4 py-3 rounded-lg transition-colors text-left`}
                        >
                            <div className="flex items-center">
                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 0 1 5 0z" />
                                </svg>
                                My Employees
                            </div>
                            <svg
                                className={`w-4 h-4 transition-transform duration-200 ${isEmployeesDropdownOpen ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {/* My Employees Dropdown Content */}
                        {isEmployeesDropdownOpen && (
                            <div className="ml-8 space-y-1">
                                <button
                                    onClick={() => onNavigate?.('employees')}
                                    className={`w-full flex items-center ${employeesActive ? 'text-white bg-gray-600' : 'text-gray-300'} hover:text-white hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors text-left text-sm`}
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                    </svg>
                                    Employees
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => onNavigate?.('reports')}
                        className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors text-left ${reportsActive ? 'bg-gray-700 text-white' : 'text-white hover:bg-gray-700'}`}>
                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
                        </svg>
                        Reports
                    </button>
                    <button className="w-full flex items-center text-white hover:bg-gray-700 px-4 py-3 rounded-lg transition-colors text-left">
                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 1 1 -6 0 3 3 0 0 1 6 0z" />
                        </svg>
                        Settings
                    </button>
                </nav>

                {/* Logout Section */}
                <div className="p-6 border-t border-gray-700">
                    <button onClick={() => { alert('Logout successfully'); onLogout(); }} className="w-full flex items-center text-white hover:bg-red-600 px-4 py-3 rounded-lg transition-colors text-left bg-red-700">
                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;