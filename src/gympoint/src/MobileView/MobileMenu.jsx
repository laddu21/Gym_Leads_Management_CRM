import React from 'react';

const MobileMenu = ({
    isMobileMenuOpen,
    toggleMobileMenu = () => { },
    isReportsDropdownOpen,
    toggleReportsDropdown = () => { },
    isDashboardDropdownOpen,
    toggleDashboardDropdown = () => { },
    isEmployeesDropdownOpen,
    toggleEmployeesDropdown = () => { },
    isNewMembersDropdownOpen,
    toggleNewMembersDropdown = () => { },
    onNavigate = () => { }
}) => {
    return (
        <>
            {isMobileMenuOpen && (
                <div
                    className="md:hidden fixed inset-0 z-50 bg-gray-800 bg-opacity-50"
                    onClick={toggleMobileMenu}>
                    <div
                        className="bg-gray-700 w-4/5 h-full shadow-lg"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 space-y-6">
                            {/* Menu Header with Close Button */}
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-white text-xl font-bold">Menu</h2>
                                <button
                                    onClick={toggleMobileMenu}
                                    className="text-white hover:text-gray-300">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Dashboard Dropdown */}
                            <div>
                                <button
                                    onClick={toggleDashboardDropdown}
                                    className="w-full text-left text-white hover:bg-gray-600 px-4 py-2 rounded flex justify-between items-center">
                                    <span>Dashboard</span>
                                    <svg className={`w-4 h-4 transition-transform ${isDashboardDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {isDashboardDropdownOpen && (
                                    <div className="ml-4 mt-2 space-y-2">
                                        <button
                                            onClick={() => {
                                                onNavigate('dashboard');
                                                toggleMobileMenu();
                                            }}
                                            className="block text-gray-300 hover:text-white px-4 py-2 rounded text-left w-full">
                                            Home
                                        </button>
                                        <button
                                            onClick={() => {
                                                onNavigate('performance');
                                                toggleMobileMenu();
                                            }}
                                            className="block text-gray-300 hover:text-white px-4 py-2 rounded text-left w-full">
                                            My Performance
                                        </button>
                                        <button
                                            onClick={() => {
                                                onNavigate('leads');
                                                toggleMobileMenu();
                                            }}
                                            className="block text-gray-300 hover:text-white px-4 py-2 rounded text-left w-full">
                                            My Leads
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Reports Dropdown */}
                            <div>
                                <button
                                    onClick={toggleReportsDropdown}
                                    className="w-full text-left text-white hover:bg-gray-600 px-4 py-2 rounded flex justify-between items-center">
                                    <span>Reports</span>
                                    <svg className={`w-4 h-4 transition-transform ${isReportsDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {isReportsDropdownOpen && (
                                    <div className="ml-4 mt-2 space-y-2">
                                        <button className="block text-gray-300 hover:text-white px-4 py-2 rounded text-left w-full">Total Members</button>
                                        <button className="block text-gray-300 hover:text-white px-4 py-2 rounded text-left w-full">Active Members</button>
                                        {/* New Members Sub-dropdown */}
                                        <div>
                                            <button
                                                onClick={toggleNewMembersDropdown}
                                                className="w-full text-left text-gray-300 hover:text-white px-4 py-2 rounded flex justify-between items-center">
                                                <span>New Members</span>
                                                <svg className={`w-3 h-3 transition-transform ${isNewMembersDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                            {isNewMembersDropdownOpen && (
                                                <div className="ml-4 mt-1 space-y-1">
                                                    <button className="block text-gray-400 hover:text-gray-200 px-4 py-1 rounded text-sm text-left w-full">Add New Member</button>
                                                    <button className="block text-gray-400 hover:text-gray-200 px-4 py-1 rounded text-sm text-left w-full">View Pending</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* My Employees Dropdown */}
                            <div>
                                <button
                                    onClick={toggleEmployeesDropdown}
                                    className="w-full text-left text-white hover:bg-gray-600 px-4 py-2 rounded flex justify-between items-center">
                                    <span>My Employees</span>
                                    <svg className={`w-4 h-4 transition-transform ${isEmployeesDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {isEmployeesDropdownOpen && (
                                    <div className="ml-4 mt-2 space-y-2">
                                        <button
                                            onClick={() => {
                                                onNavigate('employees');
                                                toggleMobileMenu();
                                            }}
                                            className="block text-gray-300 hover:text-white px-4 py-2 rounded text-left w-full">
                                            Employees
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Other Menu Items */}
                            <div className="border-t border-gray-600 pt-4 space-y-2">
                                <button className="block text-white hover:bg-gray-600 px-4 py-2 rounded text-left w-full">Settings</button>
                                <button className="block text-white hover:bg-gray-600 px-4 py-2 rounded text-left w-full">Help</button>
                                <button className="block text-red-400 hover:bg-red-500 px-4 py-2 rounded text-left w-full">Logout</button>
                            </div>
                        </div >
                    </div >
                </div >
            )}
        </>
    );
};

export default MobileMenu;
