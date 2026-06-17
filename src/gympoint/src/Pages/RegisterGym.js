import React, { useState } from 'react';
import apiClient from '../services/apiClient';

const RegisterGym = ({ onRegisterSuccess, onShowLogin }) => {
    const [gymName, setGymName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const data = await apiClient.post('/auth/register-gym', { gymName, email, password });
            setSuccess('Registration successful!');
            if (onRegisterSuccess) onRegisterSuccess({ gymName: data.gymName, email: data.email });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="register-background relative w-screen h-screen flex justify-center items-center overflow-hidden">
            <div className="register-card rounded-[28px] w-96 p-8 space-y-6 z-10">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-white mb-2">Register Your Gym</h1>
                    <p className="text-white/80 text-sm">Create your gym account</p>
                </div>
                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="flex flex-col gap-6">
                        <input
                            type="text"
                            placeholder="Gym Name"
                            className="w-full px-4 py-3 bg-white/10 text-white border border-white/20 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none transition-all placeholder-white/60"
                            value={gymName}
                            onChange={e => setGymName(e.target.value)}
                            required
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            className="w-full px-4 py-3 bg-white/10 text-white border border-white/20 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none transition-all placeholder-white/60"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Password"
                                className="w-full px-4 py-3 bg-white/10 text-white border border-white/20 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none transition-all pr-10 placeholder-white/60"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                tabIndex={-1}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white focus:outline-none"
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
                        <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-400 text-gray-900 py-3 rounded-xl font-semibold transition-colors duration-200 shadow-lg shadow-cyan-500/20" disabled={loading}>
                            {loading ? 'Registering...' : 'Register'}
                        </button>
                    </div>
                    {success && <div className="text-cyan-200 text-sm text-center mt-2">{success}</div>}
                    {error && <div className="text-red-300 text-sm text-center mt-2">{error}</div>}
                </form>
                <div className="text-center mt-4">
                    <button
                        type="button"
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        onClick={onShowLogin}
                    >
                        Already have an account? Sign in
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RegisterGym;
