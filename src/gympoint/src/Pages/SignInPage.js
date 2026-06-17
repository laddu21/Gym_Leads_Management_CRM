
import React, { useState } from 'react';
import apiClient from '../services/apiClient';

const SignInPage = ({ onAuthSuccess, registeredUser, onShowRegister }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Show gym name if passed from registration
    const gymName = registeredUser?.gymName || '';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const data = await apiClient.post('/auth/login-gym', { email, password });
            // Check if month changed and clear data
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const lastLoginMonth = localStorage.getItem('lastLoginMonth');
            if (!lastLoginMonth || lastLoginMonth !== currentMonth) {
                try {
                    await apiClient.post('/auth/clear-month-data');
                } catch (err) {
                    console.error('Failed to clear month data:', err);
                }
            }
            localStorage.setItem('lastLoginMonth', currentMonth);
            // Save login state to localStorage
            localStorage.setItem('authenticated', 'true');
            localStorage.setItem('loginTime', Date.now().toString());
            setSuccess('Logged in successfully!');
            setError('');
            if (onAuthSuccess) onAuthSuccess();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className='login-background relative w-screen h-screen flex justify-center items-center overflow-hidden'>
            <div className='login-card rounded-3xl w-96 p-8 space-y-6'>
                {gymName && (
                    <div className='text-center'>
                        <h1 className='text-3xl font-bold text-gray-800 mb-2'>{gymName}</h1>
                    </div>
                )}
                <form className='space-y-4' onSubmit={handleSubmit}>
                    <div className='flex flex-col gap-6'>
                        <input
                            type='email'
                            placeholder='Enter Your Email'
                            className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all'
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            autoFocus
                            required
                        />
                        <div className='relative'>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder='Enter Your Password'
                                className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all pr-10'
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type='button'
                                tabIndex={-1}
                                className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none'
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.657.336-3.236.938-4.675M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.062-4.675A9.956 9.956 0 0122 9c0 5.523-4.477 10-10 10a9.956 9.956 0 01-4.675-.938M3 3l18 18" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm7-2s-3-5-10-5-10 5-10 5 3 5 10 5 10-5 10-5z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        <button type='submit' className='w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium transition-colors duration-200' disabled={loading}>
                            {loading ? 'Signing In...' : 'Sign In'}
                        </button>
                    </div>
                    {success && <div className='text-green-600 text-sm text-center mt-2'>{success}</div>}
                    {error && <div className='text-red-600 text-sm text-center mt-2'>{error}</div>}
                </form>
                <div className='text-center mt-4'>
                    <button
                        type='button'
                        className='text-blue-600 hover:text-blue-800 text-sm font-medium'
                        onClick={onShowRegister}
                    >
                        Create a new account instead
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SignInPage;
