import React, { useState } from 'react';

const MobileHeader = ({ isMobileMenuOpen, toggleMobileMenu, onValidSearch }) => {
    const [searchValue, setSearchValue] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSearchChange = (e) => {
        const value = e.target.value;
        // Only allow digits and limit to 10 characters
        if (/^\d{0,10}$/.test(value)) {
            setSearchValue(value);
            setErrorMessage(''); // Clear error when user starts typing
        }
    };

    const handleSearchKeyPress = (e) => {
        if (e.key === 'Enter') {
            if (searchValue.length === 10) {
                onValidSearch(searchValue);
                setSearchValue('');
            } else if (searchValue.length > 0) {
                setErrorMessage('Please enter exactly 10 digits.');
            }
        }
    };

    return (
        <div className="md:hidden bg-gray-600 flex flex-col">
            <div className="flex items-center px-4 py-3 space-x-3">
                <button className="text-white p-2 hover:bg-gray-700 rounded transition-all duration-300 flex-shrink-0"
                    onClick={toggleMobileMenu}
                    aria-label="Toggle mobile menu">
                    {!isMobileMenuOpen ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    )}
                </button>

                {/* Mobile Search Bar */}
                <div className="flex-1 mx-2">
                    <div className="relative">
                        <input
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="Enter 10-digit number..."
                            value={searchValue}
                            onChange={handleSearchChange}
                            onKeyPress={handleSearchKeyPress}
                            className="w-full px-4 py-2 pl-10 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
            {errorMessage && (
                <div className="px-4 pb-2">
                    <p className="text-red-400 text-sm">{errorMessage}</p>
                </div>
            )}
        </div>
    );
};

export default MobileHeader;