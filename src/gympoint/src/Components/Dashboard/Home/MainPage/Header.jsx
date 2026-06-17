import React from 'react';

const Header = ({ isMobileMenuOpen, toggleMobileMenu }) => {
    return (
        <div className='w-full bg-gray-600 flex items-center justify-between px-4 md:px-10 py-2'>
            {/* Mobile menu button - only visible on small screens */}
            <button
                className='md:hidden text-white p-2 hover:bg-gray-700 rounded transition-all duration-300'
                onClick={toggleMobileMenu}
                aria-label="Toggle mobile menu">
                {/* Toggle between hamburger and X icon */}
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

            {/* H1 heading - hidden on mobile, visible on desktop */}
            <h1 className='hidden md:block text-white text-xl md:text-3xl font-bold'>RISE by GymPoint</h1>

            {/* Search bar - visible on both mobile and desktop, hidden when mobile menu is open */}
            <input
                type='search'
                placeholder='Search by Number'
                className={`flex-1 md:flex-none mx-4 md:mx-0 px-4 py-1 rounded focus:outline-none focus:ring-2 ${isMobileMenuOpen ? 'md:block hidden' : 'block'}`}
            />

            {/* Desktop logout button - hidden on mobile */}
            <button className='hidden md:block bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700'>Logout</button>
        </div>
    );
};

export default Header;