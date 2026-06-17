import React, { useEffect, useMemo, useState } from 'react';
import { leadsService } from '../services/leadsService';
// Removed unused import: leadsService (was causing "defined but never used")

const DEFAULT_LEAD_STATUS = 'New';
const TRIAL_LEAD_STATUS = 'Trial Attended';

function RecordPitchForm({
    searchNumber,
    searchName,
    preSelectedPlan = '',
    preSelectedCategory = '',
    planPrice = null,
    mode = 'lead',
    onClose,
    onOpenMembership = () => { },
    onCompleteTrial = () => { }
}) {
    const [interest, setInterest] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [memberName, setMemberName] = useState('');
    const [currentDate, setCurrentDate] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [interestError, setInterestError] = useState('');
    const isTrialMode = mode === 'trial';

    const formInstanceId = useMemo(
        () => Math.random().toString(36).slice(2, 10),
        []
    );

    const fieldNames = useMemo(
        () => ({
            name: `client-name-${formInstanceId}`,
            phone: `client-phone-${formInstanceId}`,
            email: `client-email-${formInstanceId}`,
            leadSource: `client-lead-source-${formInstanceId}`,
            plan: `client-plan-${formInstanceId}`,
            planCategory: `client-plan-category-${formInstanceId}`,
            interest: `client-interest-${formInstanceId}`,
            remarks: `client-remarks-${formInstanceId}`,
            pitchDate: `client-pitch-date-${formInstanceId}`
        }),
        [formInstanceId]
    );

    const capitalizeFirst = (value = '') => {
        if (!value) {
            return '';
        }
        return value.charAt(0).toUpperCase() + value.slice(1);
    };

    useEffect(() => {
        if (searchNumber) {
            setPhoneNumber(searchNumber);
        }
    }, [searchNumber]);

    useEffect(() => {
        if (typeof searchName === 'string') {
            setMemberName(capitalizeFirst(searchName.trim()));
        }
    }, [searchName]);

    useEffect(() => {
        const updateDate = () => {
            const today = new Date();
            const formattedDate = today.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            setCurrentDate(formattedDate);
        };

        updateDate();

        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const timeUntilMidnight = tomorrow.getTime() - now.getTime();

        const midnightTimer = setTimeout(() => {
            updateDate();
            setInterval(updateDate, 24 * 60 * 60 * 1000);
        }, timeUntilMidnight);

        return () => clearTimeout(midnightTimer);
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();

        setErrorMessage('');
        setStatusMessage('');

        const formData = new FormData(event.currentTarget);
        const submission = {
            name: formData.get(fieldNames.name)?.toString().trim() || '',
            phone: formData.get(fieldNames.phone)?.toString().trim() || '',
            leadSource: formData.get(fieldNames.leadSource)?.toString() || '',
            plan: formData.get(fieldNames.plan)?.toString() || '',
            planCategory: formData.get(fieldNames.planCategory)?.toString() || '',
            planPrice: planPrice,
            interest: formData.get(fieldNames.interest)?.toString() || '',
            remarks: formData.get(fieldNames.remarks)?.toString().trim() || '',
            pitchDate: formData.get(fieldNames.pitchDate)?.toString() || ''
        };

        if (!submission.phone) {
            setErrorMessage('Phone number is required.');
            return;
        }

        if (!submission.interest) {
            setInterestError('Select a level of interest before continuing.');
            return;
        }
        setInterestError('');

        try {
            setIsProcessing(true);
            // Removed "Saving lead..." status message as requested

            const detailPayload = {
                ...submission,
                status: isTrialMode ? TRIAL_LEAD_STATUS : DEFAULT_LEAD_STATUS,
                recordedAt: new Date().toISOString()
            };

            // Backend will handle duplicate detection and update existing lead if found
            console.log('Creating/updating lead for phone:', submission.phone);
            const response = await leadsService.create({
                name: submission.name,
                phone: submission.phone,
                email: submission.email || '',
                source: submission.leadSource,
                interest: submission.interest,
                status: detailPayload.status,
                notes: submission.remarks,
                pitchDate: submission.pitchDate,
                leadSource: submission.leadSource
            });

            const leadResult = response.data || response;
            const isDuplicate = response.message && response.message.includes('already exists');

            if (isDuplicate) {
                console.log('Lead already exists, updated:', leadResult.id || leadResult.phone);
                setStatusMessage('Phone number already exists. Lead information updated successfully.');
            }

            console.log('Lead operation completed successfully, detailPayload:', detailPayload);

            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('lead:created', { detail: { ...detailPayload, id: leadResult.id } }));
                // Also dispatch status update event so MyLeads page refreshes properly
                window.dispatchEvent(new CustomEvent('lead:status-updated', { detail: { phone: submission.phone, status: detailPayload.status } }));
            }

            if (isTrialMode) {
                onCompleteTrial({ ...detailPayload, remarks: submission.remarks });
                setStatusMessage('Trial lead recorded successfully. Returning to dashboard...');
            } else {
                console.log('Calling onOpenMembership with submission:', submission);
                onOpenMembership(submission);
                setStatusMessage('Lead details collected. Opening membership setup...');
            }

            event.currentTarget.reset();
            setInterest('');
            setPhoneNumber('');
            setMemberName('');
            setInterestError('');
        } catch (error) {
            console.log('Lead creation failed:', error);
            const apiMessage = error?.body?.error || error?.body?.message;
            setErrorMessage(apiMessage || error.message || 'Something went wrong. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-3 sm:p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            <form
                className="w-full max-w-4xl mx-auto bg-slate-900/90 border border-slate-800 shadow-2xl shadow-slate-950/60 rounded-3xl p-5 sm:p-8"
                autoComplete="off"
                onSubmit={handleSubmit}
            >
                <div className="mb-4 relative flex items-center justify-center">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-0 right-0 text-slate-500 hover:text-slate-200 text-xl sm:text-2xl font-bold"
                        title="Close"
                    >
                        ×
                    </button>
                    <h2 className="text-center text-2xl sm:text-3xl font-semibold text-white pr-8">Record Pitch</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-6">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-slate-300 mb-2 font-medium text-sm sm:text-base">Name</label>
                            <input
                                type="text"
                                name={fieldNames.name}
                                data-field="name"
                                required
                                placeholder="Enter Your Name"
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="words"
                                spellCheck={false}
                                value={memberName}
                                onChange={(event) => setMemberName(capitalizeFirst(event.target.value))}
                                className="w-full border border-slate-800 rounded-xl px-3 py-2 bg-slate-900/80 text-gray-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-300 mb-2 font-medium text-sm sm:text-base">Phone Number</label>
                            <input
                                type="text"
                                name={fieldNames.phone}
                                data-field="phone"
                                placeholder="Enter Your Number"
                                value={phoneNumber}
                                onChange={(event) => setPhoneNumber(event.target.value)}
                                required
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                inputMode="numeric"
                                className="w-full border border-slate-800 rounded-xl px-3 py-2 bg-slate-900/80 text-gray-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-300 mb-2 font-medium text-sm sm:text-base">Date of Pitch</label>
                            <div className="w-full border border-slate-800 rounded-xl px-3 py-2 bg-slate-800/70 text-gray-100 text-sm sm:text-base font-medium">
                                {currentDate}
                            </div>
                            <input type="hidden" name={fieldNames.pitchDate} data-field="pitch-date" value={currentDate} required />
                        </div>
                        <div>
                            <label className="block text-slate-300 mb-2 font-medium text-sm sm:text-base">Lead Source</label>
                            <select
                                name={fieldNames.leadSource}
                                data-field="lead-source"
                                required
                                autoComplete="off"
                                className="w-full border border-slate-800 rounded-xl px-3 py-2 bg-slate-900/80 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                            >
                                <option value="">Select</option>
                                <option value="referral">Referral</option>
                                <option value="website">Website</option>
                                <option value="event">Event</option>
                                <option value="walk-in">Walk-in</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-slate-300 mb-2 font-medium">Level of Interest</label>
                            <input type="hidden" name={fieldNames.interest} data-field="interest-level" required value={interest} />
                            <div className="flex flex-wrap gap-2 sm:gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setInterest('HOT');
                                        setInterestError('');
                                    }}
                                    className={`px-3 sm:px-4 py-2 rounded-xl font-bold border text-sm sm:text-base transition-colors ${interest === 'HOT' ? 'bg-red-600 text-white border-red-500' : 'bg-slate-900 text-red-400 border-red-500 hover:bg-red-600 hover:text-white'}`}
                                >
                                    HOT
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setInterest('WARM');
                                        setInterestError('');
                                    }}
                                    className={`px-3 sm:px-4 py-2 rounded-xl font-bold border text-sm sm:text-base transition-colors ${interest === 'WARM' ? 'bg-orange-500 text-white border-orange-400' : 'bg-slate-900 text-orange-400 border-orange-400 hover:bg-orange-500 hover:text-white'}`}
                                >
                                    WARM
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setInterest('COLD');
                                        setInterestError('');
                                    }}
                                    className={`px-3 sm:px-4 py-2 rounded-xl font-bold border text-sm sm:text-base transition-colors ${interest === 'COLD' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-900 text-blue-400 border-blue-500 hover:bg-blue-600 hover:text-white'}`}
                                >
                                    COLD
                                </button>
                            </div>
                            {interestError && (
                                <p className="mt-2 text-sm font-medium text-rose-300">{interestError}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-slate-300 mb-2 font-medium text-sm sm:text-base">Select Plan</label>
                            <select
                                name={fieldNames.plan}
                                data-field="plan-duration"
                                required
                                defaultValue={preSelectedPlan}
                                autoComplete="off"
                                className="w-full border border-slate-800 rounded-xl px-3 py-2 bg-slate-900/80 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                            >
                                <option value="">Choose duration</option>
                                <option value="1m">1 Month</option>
                                <option value="3m">3 Months</option>
                                <option value="6m">6 Months</option>
                                <option value="12m">12 Months</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-slate-300 mb-2 font-medium text-sm sm:text-base">Plan Type</label>
                            <select
                                name={fieldNames.planCategory}
                                data-field="plan-category"
                                required
                                defaultValue={preSelectedCategory || 'premium'}
                                autoComplete="off"
                                className="w-full border border-slate-800 rounded-xl px-3 py-2 bg-slate-900/80 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                            >
                                <option value="">Choose plan type</option>
                                <option value="premium">Premium</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-slate-300 mb-2 font-medium text-sm sm:text-base">Remarks</label>
                            <textarea
                                name={fieldNames.remarks}
                                data-field="remarks"
                                required
                                placeholder="Add Comments"
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                className="w-full border border-slate-800 rounded-2xl px-3 py-3 bg-slate-900/80 text-gray-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                                rows="4"
                            />
                        </div>
                    </div>

                    {(statusMessage || errorMessage) && (
                        <div className="md:col-span-2 mt-2">
                            {statusMessage && (
                                <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
                                    {statusMessage}
                                </p>
                            )}
                            {errorMessage && (
                                <p className="mt-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
                                    {errorMessage}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="md:col-span-2 flex justify-center mt-4">
                        <button
                            type="submit"
                            disabled={isProcessing}
                            className={`w-full sm:w-auto px-6 sm:px-8 py-3 font-semibold rounded-2xl transition duration-200 text-sm sm:text-base shadow-lg shadow-blue-500/30 ${isProcessing ? 'bg-blue-400/60 text-white' : 'bg-blue-500 text-white hover:bg-blue-400'}`}
                        >
                            {isTrialMode ? 'Submit Trial Lead' : 'Submit Lead'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}

export default RecordPitchForm;