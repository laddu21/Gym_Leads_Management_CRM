import React, { useEffect, useState } from 'react';

const DashboardHeader = () => {
    // Timer state for 24hr countdown
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        const updateTimer = () => {
            const now = new Date();
            const midnight = new Date(now);
            midnight.setHours(0, 0, 0, 0);
            const nextMidnight = new Date(midnight);
            nextMidnight.setDate(midnight.getDate() + 1);
            const msLeft = nextMidnight - now;
            setTimeLeft(msLeft);
        };
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    };

    return (
        <div className='w-full mb-6'>
            {/* Sale Banner for Rise Fitness */}
            <div className="relative bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 rounded-xl overflow-hidden shadow-lg mb-4 dashboard-header-mobile">
                {/* Background Pattern Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-20"></div>

                {/* Banner Content */}
                <div className="relative z-10 p-3 sm:p-6 lg:p-8">
                    <div className="flex flex-col md:flex-row items-center justify-between">
                        {/* Left Content */}
                        <div className="text-white space-y-3 sm:space-y-4">
                            <div className="space-y-2">
                                <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold">
                                    🔥 RISE FITNESS
                                </h1>
                                <h2 className="text-base sm:text-lg lg:text-2xl font-semibold">
                                    MEGA SALE!
                                </h2>
                            </div>
                            <p className="text-sm sm:text-base lg:text-lg opacity-90 max-w-md">
                                Get fit and rise to your best self with our exclusive offers
                            </p>
                            <div className="flex flex-row gap-2 sm:gap-3">
                                <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg px-1.5 py-1.5 sm:px-2 sm:py-2 flex-1 text-center min-w-0">
                                    <span className="text-sm sm:text-lg font-bold">50% OFF</span>
                                    <span className="text-xs block">Annual Membership</span>
                                </div>
                                <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg px-1.5 py-1.5 sm:px-2 sm:py-2 flex-1 text-center min-w-0">
                                    <span className="text-sm sm:text-lg font-bold">FREE</span>
                                    <span className="text-xs block">Personal Training</span>
                                </div>
                                {/* Timer block - only visible on mobile */}
                                <div className="md:hidden bg-white bg-opacity-20 backdrop-blur-sm rounded-lg px-1.5 py-1.5 sm:px-2 sm:py-2 flex-1 text-center min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                                        Ends in
                                    </p>
                                    <p className="font-mono text-sm sm:text-lg font-bold text-white mt-1 tracking-[0.1em]">
                                        {formatTime(timeLeft)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Right Content - Timer for Desktop */}
                        <div className="hidden md:flex flex-shrink-0">
                            <div className="relative">
                                <div className="absolute inset-0 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30"></div>
                                <div className="relative px-3 py-2 sm:px-4 sm:py-3 text-center">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                                        Offer Ends in
                                    </p>
                                    <p className="font-mono text-xl sm:text-2xl font-bold text-white mt-1 tracking-[0.2em]">
                                        {formatTime(timeLeft)}
                                    </p>
                                    <div className="mt-2 flex items-center justify-center gap-2 text-white/70 text-xs">
                                        <span className="h-px w-4 sm:w-5 bg-white/40"></span>
                                        <span className="hidden sm:inline">Hurry before Offer Ends</span>
                                        <span className="sm:hidden">Hurry!</span>
                                        <span className="h-px w-4 sm:w-5 bg-white/40"></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Decorative Elements */}
                    <div className="absolute top-2 right-2 sm:top-4 sm:right-4 opacity-10">
                        <div className="w-12 h-12 sm:w-20 sm:h-20 border-2 sm:border-4 border-white rounded-full"></div>
                    </div>
                    <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 opacity-10">
                        <div className="w-10 h-10 sm:w-16 sm:h-16 border-2 sm:border-4 border-white rounded-full"></div>
                    </div>
                </div>

                {/* Responsive style for mobile banner height */}
                <style>{`
                    @media (max-width: 640px) {
                        .dashboard-header-mobile {
                            min-height: 40px !important;
                            padding-top: 0.75rem !important;
                            padding-bottom: 0.75rem !important;
                        }
                    }
                    @media (min-width: 641px) and (max-width: 1024px) {
                        .dashboard-header-mobile {
                            min-height: 60px !important;
                        }
                    }
                `}</style>
            </div>
        </div>
    );
};

export default DashboardHeader;