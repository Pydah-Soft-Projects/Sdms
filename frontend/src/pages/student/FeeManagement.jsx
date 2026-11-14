import React, { useEffect, useState, useMemo } from 'react';
import {
    FileText,
    Clock,
    RotateCw,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Calendar,
    Receipt,
    CreditCard,
    CheckCircle2,
    X,
    AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SkeletonBox } from '../../components/SkeletonLoader';
import useAuthStore from '../../store/authStore';
import api from '../../config/api';
import paymentService from '../../services/paymentService';

const isClubFeeInvoice = (invoice) => {
    const feeHeadName = String(typeof invoice?.feeHead === 'object' ? invoice.feeHead?.name || '' : '').trim().toLowerCase();
    const remarks = String(invoice?.remarks || '').trim().toLowerCase();
    return String(invoice?.feeHead?.code || '').toUpperCase() === 'CF' ||
        feeHeadName.startsWith('club fee') ||
        /^club\s*fee\s*[:\-–]/i.test(remarks);
};

const getClubNameFromRemarks = (remarks) => String(remarks || '')
    .replace(/^\s*(?:club\s*fee\s*[:\-–]\s*)+/i, '')
    .trim();

const getClubNameFromInvoice = (invoice) => getClubNameFromRemarks(invoice?.remarks) ||
    String(invoice?.feeHead?.name || '').replace(/^\s*club\s*fee\s*[:\-–]\s*/i, '').trim() ||
    'Club';

const calculateInvoicePaid = (invoice, transactions = [], allInvoices = []) => {
    if (isClubFeeInvoice(invoice) && invoice.status === 'cancelled') return 0;

    let paid = 0;
    const isServiceFee = invoice.feeHead?.code === 'SSF' || invoice.feeHead?.name === 'Student Services FEE';
    const isClubFee = isClubFeeInvoice(invoice);
    const clubName = isClubFee ? getClubNameFromRemarks(invoice.remarks) : '';

    const invoiceHeadId = invoice.feeHead?._id || invoice.feeHead;
    const invoiceHeadName = invoice.feeHead?.name?.toLowerCase() || '';

    // Check if there are multiple invoices for this exact feeHead in this year
    const sameHeadInvoicesInYear = allInvoices.filter(inv => {
        const invHeadId = inv.feeHead?._id || inv.feeHead;
        const invHeadName = inv.feeHead?.name?.toLowerCase() || '';
        const sameHead = (invoiceHeadId && invHeadId && String(invoiceHeadId) === String(invHeadId)) ||
            (invoiceHeadName && invHeadName && invoiceHeadName === invHeadName);
        return sameHead && inv.studentYear?.toString() === invoice.studentYear?.toString();
    });
    const hasMultipleSemInvoices = sameHeadInvoicesInYear.length > 1;

    transactions.forEach(transaction => {
        if (transaction.status && transaction.status !== 'active') return;
        let isServiceMatch = false;
        if (isServiceFee && invoice.remarks) {
            const refMatch = invoice.remarks.match(/\(Ref: (\d+)\)/);
            if (refMatch && transaction.remarks) {
                isServiceMatch = transaction.remarks.includes(`Ref: ${refMatch[1]}`) || transaction.remarks.includes(`SR-${refMatch[1]}`);
            }
        }

        const transactionHeadId = transaction.feeHead?._id || transaction.feeHead;
        const transactionHeadName = transaction.feeHead?.name?.toLowerCase() || '';

        const sameFeeHead = (invoiceHeadId && transactionHeadId && String(invoiceHeadId) === String(transactionHeadId)) ||
            (invoiceHeadName && transactionHeadName && invoiceHeadName === transactionHeadName) ||
            (invoice.feeHead?.code && transaction.feeHead?.code && invoice.feeHead.code.toUpperCase() === transaction.feeHead.code.toUpperCase());

        const sameYear = !transaction.studentYear || !invoice.studentYear || transaction.studentYear?.toString() === invoice.studentYear?.toString();

        let sameSemester = true;
        if (hasMultipleSemInvoices && transaction.semester && invoice.semester) {
            sameSemester = transaction.semester.toString() === invoice.semester.toString();
        }

        if (!(sameFeeHead && sameYear && sameSemester) && !isServiceMatch) return;

        if (isClubFee && clubName && (!transaction.remarks || !transaction.remarks.toLowerCase().includes(clubName.toLowerCase()))) return;

        if (isServiceFee && !isServiceMatch && invoice.remarks) {
            const refMatch = invoice.remarks.match(/\(Ref: (\d+)\)/);
            if (refMatch && !transaction.remarks?.includes(`Ref: ${refMatch[1]}`) && !transaction.remarks?.includes(`SR-${refMatch[1]}`)) return;
        }

        paid += Number(transaction.amount) || 0;
    });

    return paid;
};

// Helper to check if a transaction is a credit/waiver
const isCredit = (tx) => {
    const mode = tx.paymentMode?.toLowerCase() || '';
    const remark = tx.remarks?.toLowerCase() || '';
    return mode.includes('waiver') ||
        mode.includes('adjustment') ||
        mode.includes('concession') ||
        mode.includes('credit') ||
        remark.includes('concession') ||
        remark.includes('scholarship') ||
        remark.includes('credit');
};

const FeeManagement = () => {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [feeData, setFeeData] = useState(null);
    const [error, setError] = useState(null);

    // Selected year for the top cards & tables
    const [selectedYear, setSelectedYear] = useState(4);

    // Filters
    const [feeStatusFilter, setFeeStatusFilter] = useState('Active Fees'); // 'Active Fees', 'All Fees', 'Cancelled Fees'
    const [txModeFilter, setTxModeFilter] = useState('All');
    const [txHeadFilter, setTxHeadFilter] = useState('All');

    // Online Payment Modal State
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [paymentTarget, setPaymentTarget] = useState(null);
    const [payAmountInput, setPayAmountInput] = useState('');
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

    // Expandable years for breakdown accordions
    const [expandedYears, setExpandedYears] = useState({});

    const toggleExpandYear = (yr) => {
        setExpandedYears(prev => ({
            ...prev,
            [yr]: prev[yr] === undefined ? false : !prev[yr]
        }));
    };

    const fetchFeeDetails = async () => {
        const admissionNum = user?.admission_number || user?.admissionNumber;
        if (!admissionNum && !user?.studentId && !user?.id) return;
        try {
            setLoading(true);
            setError(null);
            let response = null;

            if (user?.role === 'parent') {
                response = await api.get('/parent/fees')
                    .catch(async () => {
                        const target = admissionNum || user?.studentId || user?.id;
                        return await api.get(`/fees/students/${target}/details`);
                    });
            } else {
                const target = admissionNum || user?.studentId || user?.id;
                response = await api.get(`/fees/students/${target}/details`);
            }

            if (response?.data?.success) {
                setFeeData(response.data);
                const currYear = response.data.studentDetails?.currentYear;
                if (currYear) {
                    setSelectedYear(Number(currYear));
                }
            } else {
                setError(response?.data?.message || 'Failed to load fee details');
            }
        } catch (err) {
            console.error('Error fetching fee details:', err);
            setError('Unable to fetch fee information. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFeeDetails();
    }, [user]);

    // Handle return from PPG Hosted Checkout (?paymentId=...&status=SUCCEEDED)
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const paymentId = searchParams.get('paymentId');
        const pStatus = searchParams.get('status');

        if (paymentId) {
            // Clean the query string from address bar without reloading
            window.history.replaceState({}, document.title, window.location.pathname);

            if (pStatus === 'SUCCEEDED' || !pStatus) {
                paymentService.confirmPayment(paymentId)
                    .then((res) => {
                        fetchFeeDetails();
                        const rcpt = res.receiptNumber || res.transaction?.receiptNumber;
                        if (rcpt) {
                            toast.success(`Payment verified! Receipt: ${rcpt}`, { duration: 6000 });
                        } else {
                            toast.success('Payment verified and recorded successfully!');
                        }
                    })
                    .catch((err) => {
                        console.error('Payment confirmation error:', err);
                        fetchFeeDetails();
                        toast.error(err.response?.data?.error || err.message || 'Payment confirmation error');
                    });
            } else if (pStatus === 'FAILED' || pStatus === 'CANCELLED') {
                toast.error('Payment was cancelled or failed at the gateway.');
            }
        }
    }, []);

    const formatNumber = (amount) => {
        const val = Number(amount) || 0;
        return new Intl.NumberFormat('en-IN').format(val);
    };

    const { fees, transactions, studentDetails } = feeData || {};

    // Determine the list of academic years (standard Year 1 to Year 4 or from data)
    const availableYears = useMemo(() => {
        const set = new Set([1, 2, 3, 4]);
        (fees || []).forEach(f => {
            if (f.studentYear) set.add(Number(f.studentYear));
        });
        (transactions || []).forEach(t => {
            if (t.studentYear) set.add(Number(t.studentYear));
        });
        if (studentDetails?.currentYear) {
            set.add(Number(studentDetails.currentYear));
        }
        return Array.from(set).sort((a, b) => a - b);
    }, [fees, transactions, studentDetails]);

    // Calculate Summary Stats for each Year (for the top cards)
    const yearStatsMap = useMemo(() => {
        const map = {};
        availableYears.forEach(yr => {
            let total = 0;
            let paid = 0;
            let concession = 0;

            (fees || []).forEach(f => {
                if (Number(f.studentYear) === Number(yr)) {
                    if (f.status !== 'cancelled') {
                        total += Number(f.amount) || 0;
                    }
                }
            });

            (transactions || []).forEach(tx => {
                if (tx.status && tx.status !== 'active') return;
                const txYr = Number(tx.studentYear);
                if (txYr && txYr !== Number(yr)) return;

                const amt = Number(tx.amount) || 0;
                if (tx.transactionType === 'CREDIT' || isCredit(tx)) {
                    concession += amt;
                } else {
                    paid += amt;
                }
            });

            const balance = Math.max(0, total - paid - concession);
            map[yr] = {
                total,
                paid,
                concession,
                balance,
                isPaid: balance <= 0
            };
        });
        return map;
    }, [availableYears, fees, transactions]);

    // Filter fees for a specific year and feeStatusFilter
    const getInvoicesForYear = (yr) => {
        let list = (fees || []).filter(f => Number(f.studentYear) === Number(yr));

        if (feeStatusFilter === 'Active Fees') {
            list = list.filter(f => f.status !== 'cancelled');
        } else if (feeStatusFilter === 'Cancelled Fees') {
            list = list.filter(f => f.status === 'cancelled');
        }

        return list.map((inv, index) => {
            const paid = calculateInvoicePaid(inv, transactions, fees || []);
            const concession = 0;
            const totalFee = Number(inv.amount) || 0;
            const balance = Math.max(0, totalFee - paid - concession);

            let status = 'Unpaid';
            if (balance <= 0) {
                status = 'Paid';
            } else if (paid > 0) {
                status = 'Partial';
            }

            const isInstallmentBased = (inv.feeHead?.name || '').toLowerCase().includes('transport') ||
                (inv.feeHead?.name || '').toLowerCase().includes('bus') ||
                totalFee >= 10000;

            let t1Due = '—';
            let t2Due = '- - -';

            if (isInstallmentBased && totalFee > 0) {
                const term1Target = Math.round(totalFee / 2);
                const term2Target = totalFee - term1Target;

                const t1Bal = Math.max(0, term1Target - paid);
                const paidForT2 = Math.max(0, paid - term1Target);
                const t2Bal = Math.max(0, term2Target - paidForT2);

                t1Due = t1Bal > 0 ? formatNumber(t1Bal) : '—';
                t2Due = t2Bal > 0 ? formatNumber(t2Bal) : '—';
            } else {
                if (totalFee === 0) {
                    t1Due = '—';
                    t2Due = '- - -';
                } else {
                    t1Due = balance > 0 ? formatNumber(balance) : '—';
                    t2Due = '- - -';
                }
            }

            let headTitle = inv.feeHead?.name || 'Academic Fee';
            if (isClubFeeInvoice(inv)) {
                const clubName = getClubNameFromInvoice(inv);
                headTitle = `Club Fee - ${clubName}`;
            } else if (inv.feeHead?.code === 'SSF' || inv.feeHead?.name === 'Student Services FEE') {
                if (inv.remarks) {
                    headTitle = `Student Services FEE - ${inv.remarks.replace(/^Service Request:\s*/i, '')}`;
                } else {
                    headTitle = 'Student Services FEE';
                }
            }

            const rowKey = inv._id || `inv-${yr}-${index}`;

            return {
                ...inv,
                rowKey,
                headTitle,
                yearSemLabel: `Year ${inv.studentYear} • Sem ${inv.semester || 1}`,
                totalFee,
                t1Due,
                t2Due,
                t1DueNum: t1Due !== '—' && t1Due !== '- - -' ? Number(String(t1Due).replace(/,/g, '')) : 0,
                t2DueNum: t2Due !== '—' && t2Due !== '- - -' ? Number(String(t2Due).replace(/,/g, '')) : 0,
                paid,
                concession,
                balance,
                status
            };
        });
    };

    // Calculate totals for a given array of invoices
    const getYearTotals = (invoices) => {
        let totalFee = 0;
        let paid = 0;
        let concession = 0;
        let balance = 0;

        invoices.forEach(row => {
            totalFee += row.totalFee || 0;
            paid += row.paid || 0;
            concession += row.concession || 0;
            balance += row.balance || 0;
        });

        const term1Target = Math.round(totalFee / 2);
        const term2Target = totalFee - term1Target;
        const t1Bal = Math.max(0, term1Target - paid);
        const paidForT2 = Math.max(0, paid - term1Target);
        const t2Bal = Math.max(0, term2Target - paidForT2);

        return {
            totalFee,
            paid,
            concession,
            balance,
            t1Due: t1Bal > 0 ? formatNumber(t1Bal) : '—',
            t2Due: t2Bal > 0 ? formatNumber(t2Bal) : '—'
        };
    };

    // Open Payment Modal for a single invoice row
    const openPaymentModal = (row) => {
        const parsedServiceId = (row.feeHead?.code === 'SSF' && row.remarks)
            ? (row.remarks.match(/\(Ref:\s*(\d+)\)/)?.[1] || row.remarks.match(/SR-(\d+)/)?.[1] || null)
            : null;

        setPaymentTarget({
            title: row.headTitle,
            feeHeadId: row.feeHead?._id || row.feeHead,
            studentYear: row.studentYear,
            semester: row.semester || 1,
            totalFee: row.totalFee,
            paid: row.paid,
            balance: row.balance,
            t1DueNum: row.t1DueNum || 0,
            t2DueNum: row.t2DueNum || 0,
            remarks: row.remarks || row.headTitle,
            serviceRequestId: parsedServiceId,
        });
        setPayAmountInput(String(row.balance));
        setPaymentModalOpen(true);
    };

    // Open Payment Modal for the total Year balance
    const openYearPaymentModal = (yr, yrTotals, yrInvoices) => {
        const pendingInvoices = yrInvoices.filter(i => i.balance > 0);
        const firstPending = pendingInvoices[0];

        setPaymentTarget({
            title: `Year ${yr} Dues (${pendingInvoices.map(i => i.headTitle).join(', ') || 'Academic Fees'})`,
            feeHeadId: firstPending?.feeHead?._id || firstPending?.feeHead,
            studentYear: yr,
            semester: firstPending?.semester || 1,
            totalFee: yrTotals.totalFee,
            paid: yrTotals.paid,
            balance: yrTotals.balance,
            t1DueNum: 0,
            t2DueNum: 0,
            remarks: `Year ${yr} Fee Payment`,
            serviceRequestId: null,
        });
        setPayAmountInput(String(yrTotals.balance));
        setPaymentModalOpen(true);
    };

    // Trigger payment via PPG Drop-in Checkout Popup (In-page Modal)
    const handleConfirmPayment = async () => {
        const num = Number(payAmountInput);
        if (!num || isNaN(num) || num <= 0) {
            toast.error('Please enter a valid payment amount');
            return;
        }

        if (paymentTarget?.balance && num > paymentTarget.balance) {
            toast.error(`Payment amount cannot exceed the balance due of ₹${formatNumber(paymentTarget.balance)}`);
            return;
        }

        try {
            setIsProcessingPayment(true);
            await paymentService.openCheckout({
                amountInRupees: num,
                collegeCode: user?.college_code || studentDetails?.collegeCode || user?.college || undefined,
                courseCode: user?.course_code || studentDetails?.courseCode || user?.course || undefined,
                studentId: user?.admission_number,
                description: `${paymentTarget.title} - Year ${paymentTarget.studentYear}`,
                customerName: user?.student_name || user?.name || studentDetails?.name || studentDetails?.studentName,
                customerEmail: user?.student_email || user?.email,
                customerPhone: user?.student_mobile || user?.mobile,
                feeHeadId: paymentTarget.feeHeadId,
                studentYear: paymentTarget.studentYear,
                semester: paymentTarget.semester,
                remarks: paymentTarget.remarks,
                serviceRequestId: paymentTarget.serviceRequestId,
                onSuccess: (res) => {
                    const rcpt = res?.receiptNumber || res?.transaction?.receiptNumber;
                    if (rcpt) {
                        toast.success(`Payment verified! Receipt: ${rcpt}`, { duration: 6000 });
                    } else {
                        toast.success('Payment verified and recorded successfully!');
                    }
                    setPaymentModalOpen(false);
                    setIsProcessingPayment(false);
                    fetchFeeDetails();
                },
                onFailure: (err) => {
                    console.error('Payment checkout failure:', err);
                    toast.error(err?.message || 'Payment failed at gateway');
                    setIsProcessingPayment(false);
                },
                onClose: () => {
                    setIsProcessingPayment(false);
                }
            });
        } catch (err) {
            console.error('Payment checkout error:', err);
            toast.error(err.response?.data?.error || err.message || 'Payment initiation failed');
            setIsProcessingPayment(false);
        }
    };

    // Filter transactions for the selected year and mode/head filters
    const currentYearTransactions = useMemo(() => {
        let list = (transactions || []).filter(tx => {
            if (!tx.studentYear) return Number(selectedYear) === 4;
            return Number(tx.studentYear) === Number(selectedYear);
        });

        if (txModeFilter !== 'All') {
            list = list.filter(tx => (tx.paymentMode || '').toLowerCase() === txModeFilter.toLowerCase());
        }

        if (txHeadFilter !== 'All') {
            list = list.filter(tx => (tx.feeHead?.name || '').toLowerCase() === txHeadFilter.toLowerCase());
        }

        return list;
    }, [transactions, selectedYear, txModeFilter, txHeadFilter]);

    const transactionFeeHeads = useMemo(() => {
        const heads = new Set();
        (transactions || []).forEach(tx => {
            if (tx.feeHead?.name) heads.add(tx.feeHead.name);
        });
        return Array.from(heads);
    }, [transactions]);

    if (loading) {
        return (
            <div className="w-full space-y-6 animate-pulse font-sans text-main pb-12">
                {/* Header Skeleton */}
                <div className="flex items-center justify-between gap-4 pb-1">
                    <div className="space-y-2">
                        <SkeletonBox height="h-6" width="w-48" className="rounded-lg bg-background" />
                        <SkeletonBox height="h-3" width="w-64" className="rounded bg-background hidden sm:block" />
                    </div>
                    <SkeletonBox height="h-8" width="w-28" className="rounded-xl bg-background" />
                </div>

                {/* Main Accordion Skeleton Container */}
                <div className="border border-border rounded-2xl overflow-hidden bg-surface shadow-xs divide-y divide-border">
                    {[1, 2, 3].map((item) => (
                        <div key={item} className="p-4 sm:p-5 space-y-3.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <SkeletonBox height="h-5" width="w-10" className="rounded-md bg-background" />
                                    <SkeletonBox height="h-5" width="w-20" className="rounded-md bg-background" />
                                    <SkeletonBox height="h-4" width="w-36" className="rounded bg-background hidden sm:block" />
                                </div>
                                <SkeletonBox height="h-4" width="w-6" className="rounded-full bg-background" />
                            </div>
                            {item === 1 && (
                                <div className="pt-2 space-y-2">
                                    <SkeletonBox height="h-20" width="w-full" className="rounded-xl bg-background" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Transactions Table Skeleton */}
                <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-border">
                        <div className="flex items-center gap-3">
                            <SkeletonBox height="h-9" width="w-9" className="rounded-xl bg-background" />
                            <SkeletonBox height="h-5" width="w-40" className="rounded-lg bg-background" />
                        </div>
                        <div className="flex gap-2">
                            <SkeletonBox height="h-8" width="w-24" className="rounded-xl bg-background" />
                            <SkeletonBox height="h-8" width="w-28" className="rounded-xl bg-background" />
                        </div>
                    </div>
                    <div className="space-y-2.5 pt-1">
                        {[1, 2, 3, 4].map((i) => (
                            <SkeletonBox key={i} height="h-12" width="w-full" className="rounded-xl bg-background" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center bg-surface rounded-2xl border border-[var(--danger-light)] max-w-md mx-auto my-12">
                <p className="text-sm font-bold text-danger mb-4">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-hover transition"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="w-full space-y-6 animate-fade-in pb-12 font-sans text-main">
            {/* Fee Dues Breakdown Section with Expandable Year Accordions */}
            <div className="space-y-4">
                {/* Section Header */}
                <div className="flex flex-row items-center justify-between gap-2 pb-1">
                    <h2 className="text-sm sm:text-lg font-extrabold text-[var(--primary)] heading-font tracking-tight shrink-0">
                        Fee Dues Breakdown
                    </h2>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {/* Active Fees Dropdown */}
                        <select
                            value={feeStatusFilter}
                            onChange={(e) => setFeeStatusFilter(e.target.value)}
                            className="text-[11px] sm:text-xs font-semibold bg-surface border border-border rounded-xl px-2.5 sm:px-3 py-1.5 text-sub focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer hover:bg-background transition shadow-2xs"
                        >
                            <option value="Active Fees">Active Fees</option>
                            <option value="All Fees">All Fees</option>
                            <option value="Cancelled Fees">Cancelled Fees</option>
                        </select>
                    </div>
                </div>

                {/* Single Combined Card Container for all Year Breakdown Accordions */}
                <div className="border border-border rounded-2xl overflow-hidden bg-surface shadow-xs divide-y divide-border mt-2">
                    {[...availableYears].sort((a, b) => b - a).map(yr => {
                        const yrInvoices = getInvoicesForYear(yr);
                        const yrTotals = getYearTotals(yrInvoices);
                        const yrStats = yearStatsMap[yr] || { total: 0, paid: 0, balance: 0, isPaid: true };
                        const isExpanded = expandedYears[yr] === undefined ? true : expandedYears[yr];
                        const isPaid = yrStats.balance <= 0;

                        return (
                            <div key={yr} className="overflow-hidden">
                                {/* Accordion Header */}
                                <div 
                                    onClick={() => toggleExpandYear(yr)}
                                    className="p-3.5 sm:p-4 bg-[var(--background)]/80 hover:bg-background cursor-pointer flex items-center justify-between transition-colors select-none"
                                >
                                    <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar py-0.5 min-w-0">
                                        <span className="font-bold text-[11px] sm:text-xs text-main shrink-0">Y{yr}</span>
                                        {isPaid ? (
                                             <span className="px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider bg-[var(--success-light)] text-success border border-[var(--success-light)] shrink-0">
                                                PAID
                                            </span>
                                        ) : (
                                            <span className="px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-wider bg-[var(--danger-light)] text-danger border border-[var(--danger-light)] shrink-0">
                                                DUE
                                            </span>
                                        )}
                                        <span className="text-[8.5px] sm:text-[10px] text-muted-text font-medium whitespace-nowrap">
                                            Total: {formatNumber(yrStats.total)} • Paid: {formatNumber(yrStats.paid)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 text-muted-text">
                                            <span className="text-[11px] font-semibold hidden sm:inline">
                                                {isExpanded ? 'Collapse' : 'Expand'}
                                            </span>
                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </div>
                                    </div>
                                </div>

                                {/* Accordion Body */}
                                {isExpanded && (
                                    <div className="border-t border-border bg-surface">
                                        {/* Desktop Table View for Fee Breakdown */}
                                        <div className="hidden md:block overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-[var(--background)]/70 border-b border-border text-[10px] font-black uppercase tracking-wider text-muted-text">
                                                    <tr>
                                                        <th className="py-3 px-4 min-w-[240px]">FEE HEAD / YEAR</th>
                                                        <th className="py-3 px-4 text-right">TOTAL FEE</th>
                                                        <th className="py-3 px-4 text-center">T1 DUE</th>
                                                        <th className="py-3 px-4 text-center">T2 DUE</th>
                                                        <th className="py-3 px-4 text-right">PAID</th>
                                                        <th className="py-3 px-4 text-right text-secondary">CONCESSION</th>
                                                        <th className="py-3 px-4 text-right">BALANCE</th>
                                                        <th className="py-3 px-4 text-center">STATUS</th>
                                                        <th className="py-3 px-4 text-center">ACTION</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {yrInvoices.length > 0 ? (
                                                        yrInvoices.map((row) => (
                                                            <tr key={row.rowKey} className="hover:bg-[var(--background)]/60 transition-colors group">
                                                                <td className="py-3.5 px-4">
                                                                    <div className="flex items-center gap-1 font-bold text-main">
                                                                        <span>{row.headTitle}</span>
                                                                        <ChevronRight size={13} className="text-muted-text group-hover:text-primary transition-colors" />
                                                                    </div>
                                                                    <div className="text-[11px] text-muted-text mt-0.5">
                                                                        {row.yearSemLabel}
                                                                    </div>
                                                                </td>
                                                                <td className="py-3.5 px-4 text-right font-medium text-main">
                                                                    {formatNumber(row.totalFee)}
                                                                </td>
                                                                <td className={`py-3.5 px-4 text-center font-semibold ${row.t1Due !== '—' && row.t1Due !== '- - -' ? 'text-danger' : 'text-muted-text'}`}>
                                                                    {row.t1Due}
                                                                </td>
                                                                <td className={`py-3.5 px-4 text-center font-semibold ${row.t2Due !== '—' && row.t2Due !== '- - -' ? 'text-danger' : 'text-muted-text'}`}>
                                                                    {row.t2Due}
                                                                </td>
                                                                <td className="py-3.5 px-4 text-right font-bold text-success">
                                                                    {formatNumber(row.paid)}
                                                                </td>
                                                                <td className="py-3.5 px-4 text-right font-bold text-secondary">
                                                                    {formatNumber(row.concession)}
                                                                </td>
                                                                <td className="py-3.5 px-4 text-right font-bold text-main">
                                                                    {formatNumber(row.balance)}
                                                                </td>
                                                                <td className="py-3.5 px-4 text-center">
                                                                    {row.status === 'Paid' && (
                                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[var(--success-light)] text-success border border-[var(--success-light)]">
                                                                            Paid
                                                                        </span>
                                                                    )}
                                                                    {row.status === 'Unpaid' && (
                                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[var(--danger-light)] text-danger border border-[var(--danger-light)]">
                                                                            Unpaid
                                                                        </span>
                                                                    )}
                                                                    {row.status === 'Partial' && (
                                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[var(--warning-light)] text-warning border border-[var(--warning-light)]">
                                                                            Partial
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="py-3.5 px-4 text-center">
                                                                    {row.balance > 0 ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openPaymentModal(row)}
                                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary hover:bg-primary-hover text-white shadow-xs hover:shadow transition-all transform active:scale-95 cursor-pointer"
                                                                            title={`Pay dues for ${row.headTitle}`}
                                                                        >
                                                                            <CreditCard size={12} />
                                                                            <span>Pay Now</span>
                                                                        </button>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success bg-[var(--success-light)] px-2 py-0.5 rounded-md border border-[var(--success-light)]">
                                                                            <CheckCircle2 size={12} />
                                                                            <span>Clear</span>
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={9} className="py-6 text-center text-muted-text text-xs">
                                                                No fee records found for Year {yr}.
                                                            </td>
                                                        </tr>
                                                    )}

                                                    {/* TOTAL Row */}
                                                    {yrInvoices.length > 0 && (
                                                        <tr className="bg-[var(--background)]/50 font-black border-t-2 border-border text-main">
                                                            <td className="py-3.5 px-4">
                                                                <div className="uppercase tracking-wider text-xs">TOTAL (Y{yr})</div>
                                                            </td>
                                                            <td className="py-3.5 px-4 text-right font-black">
                                                                {formatNumber(yrTotals.totalFee)}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center font-black text-danger">
                                                                {yrTotals.t1Due}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center font-black text-danger">
                                                                {yrTotals.t2Due}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-right font-black text-success">
                                                                {formatNumber(yrTotals.paid)}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-right font-black text-secondary">
                                                                {formatNumber(yrTotals.concession)}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-right font-black text-danger text-sm">
                                                                {formatNumber(yrTotals.balance)}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center">
                                                                {yrTotals.balance <= 0 ? (
                                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[var(--success-light)] text-success border border-[var(--success-light)]">
                                                                        PAID
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[var(--danger-light)] text-danger border border-[var(--danger-light)]">
                                                                        DUE
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center">
                                                                {yrTotals.balance > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openYearPaymentModal(yr, yrTotals, yrInvoices)}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-success hover:bg-success text-white shadow-xs hover:shadow transition-all transform active:scale-95 cursor-pointer"
                                                                        title="Pay total dues for this year"
                                                                    >
                                                                        <CreditCard size={12} />
                                                                        <span>Pay All Due</span>
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Mobile Card List View for Fee Breakdown */}
                                        <div className="md:hidden divide-y divide-border p-3 sm:p-4 space-y-3">
                                            {yrInvoices.length > 0 ? (
                                                yrInvoices.map((row) => (
                                                    <div key={row.rowKey} className="pt-3 first:pt-0">
                                                        <div className="flex items-start justify-between gap-2 mb-2">
                                                            <div>
                                                                <div className="font-bold text-main text-xs leading-snug">
                                                                    {row.headTitle}
                                                                </div>
                                                                <div className="text-[10px] text-muted-text mt-0.5">
                                                                    {row.yearSemLabel}
                                                                </div>
                                                            </div>
                                                            <div className="shrink-0">
                                                                {row.status === 'Paid' && (
                                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-[var(--success-light)] text-success border border-[var(--success-light)]">
                                                                        Paid
                                                                    </span>
                                                                )}
                                                                {row.status === 'Unpaid' && (
                                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-[var(--danger-light)] text-danger border border-[var(--danger-light)]">
                                                                        Unpaid
                                                                    </span>
                                                                )}
                                                                {row.status === 'Partial' && (
                                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-[var(--warning-light)] text-warning border border-[var(--warning-light)]">
                                                                        Partial
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-3 gap-2 bg-[var(--background)]/70 p-2.5 rounded-xl border border-border text-[11px]">
                                                            <div>
                                                                <div className="text-[9px] font-bold uppercase text-muted-text">Total Fee</div>
                                                                <div className="font-bold text-main">{formatNumber(row.totalFee)}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[9px] font-bold uppercase text-muted-text">Paid</div>
                                                                <div className="font-bold text-success">{formatNumber(row.paid)}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[9px] font-bold uppercase text-muted-text">Concession</div>
                                                                <div className="font-bold text-secondary">{formatNumber(row.concession)}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[9px] font-bold uppercase text-muted-text">T1 Due</div>
                                                                <div className={`font-semibold ${row.t1Due !== '—' && row.t1Due !== '- - -' ? 'text-danger' : 'text-muted-text'}`}>
                                                                    {row.t1Due}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[9px] font-bold uppercase text-muted-text">T2 Due</div>
                                                                <div className={`font-semibold ${row.t2Due !== '—' && row.t2Due !== '- - -' ? 'text-danger' : 'text-muted-text'}`}>
                                                                    {row.t2Due}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[9px] font-bold uppercase text-muted-text">Balance</div>
                                                                <div className="font-black text-danger">{formatNumber(row.balance)}</div>
                                                            </div>
                                                        </div>

                                                        {/* Mobile Pay Button */}
                                                        {row.balance > 0 && (
                                                            <div className="mt-2.5 flex justify-end">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openPaymentModal(row)}
                                                                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white shadow-xs transition"
                                                                >
                                                                    <CreditCard size={13} />
                                                                    <span>Pay Now (₹{formatNumber(row.balance)})</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-center text-muted-text text-xs py-4">
                                                    No fee records found for Year {yr}.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Section: Transaction History Card */}
            <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
                {/* Transaction History Header */}
                <div className="p-4 sm:px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--success-light)] text-success rounded-xl">
                            <Clock size={18} />
                        </div>
                        <h2 className="text-base font-bold text-main tracking-tight">
                            Transaction History
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                            Year {selectedYear}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        {/* All Modes Dropdown */}
                        <select
                            value={txModeFilter}
                            onChange={(e) => setTxModeFilter(e.target.value)}
                            className="flex-1 sm:flex-none text-xs font-semibold bg-background border border-border rounded-xl px-2.5 sm:px-3 py-1.5 text-sub focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer hover:bg-background transition"
                        >
                            <option value="All">All Modes</option>
                            <option value="Cash">Cash</option>
                            <option value="Net Banking">Net Banking</option>
                            <option value="UPI">UPI</option>
                            <option value="Online">Online</option>
                            <option value="Cheque">Cheque</option>
                        </select>

                        {/* All Fee Heads Dropdown */}
                        <select
                            value={txHeadFilter}
                            onChange={(e) => setTxHeadFilter(e.target.value)}
                            className="flex-1 sm:flex-none text-xs font-semibold bg-background border border-border rounded-xl px-2.5 sm:px-3 py-1.5 text-sub focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer hover:bg-background transition"
                        >
                            <option value="All">All Fee Heads</option>
                            {transactionFeeHeads.map(head => (
                                <option key={head} value={head}>{head}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Desktop Transaction Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-[var(--background)]/70 border-b border-border text-[10px] font-black uppercase tracking-wider text-muted-text">
                            <tr>
                                <th className="py-3 px-4">TRANSACTION DATE</th>
                                <th className="py-3 px-4">FEE HEAD</th>
                                <th className="py-3 px-4 text-center">MODE & REF</th>
                                <th className="py-3 px-4 text-center">YEAR / SEM</th>
                                <th className="py-3 px-4 text-right">AMOUNT PAID</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {currentYearTransactions.length > 0 ? (
                                currentYearTransactions.map((tx, idx) => {
                                    const txDate = tx.paymentDate ? new Date(tx.paymentDate) : null;
                                    const dateStr = txDate
                                        ? txDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                        : '—';
                                    const timeStr = txDate
                                        ? txDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                                        : '';

                                    const isCon = tx.transactionType === 'CREDIT' || isCredit(tx);
                                    const isOnline = (tx.paymentMode || '').toLowerCase().includes('upi') ||
                                        (tx.paymentMode || '').toLowerCase().includes('online') ||
                                        tx.gatewayPaymentId;

                                    return (
                                        <tr key={tx._id || idx} className="hover:bg-[var(--background)]/60 transition-colors">
                                            <td className="py-3.5 px-4">
                                                <div className="font-bold text-main">{dateStr}</div>
                                                <div className="text-[10px] text-muted-text">{timeStr}</div>
                                            </td>
                                            <td className="py-3.5 px-4 font-bold text-main">
                                                {tx.feeHead?.name || (isCon ? 'Scholarship / Concession' : 'Fee Payment')}
                                                {tx.remarks && (
                                                    <div className="text-[10px] text-muted-text font-normal mt-0.5">{tx.remarks}</div>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="inline-block px-2.5 py-0.5 rounded-md border border-border bg-background text-[10px] font-bold text-sub">
                                                        {tx.paymentMode || 'Cash'}
                                                    </span>
                                                    {tx.receiptNumber && (
                                                        <span className="inline-block px-2 py-0.5 rounded-md border border-[var(--primary-light)] bg-[var(--primary-light)] text-[9.5px] font-mono font-bold text-primary">
                                                            {tx.receiptNumber}
                                                        </span>
                                                    )}
                                                    {(tx.referenceNo || tx.gatewayPaymentId) && (
                                                        <div className="text-[10px] text-muted-text font-mono">
                                                            {tx.referenceNo || tx.gatewayPaymentId}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <span className="text-sub font-semibold">
                                                    Y{tx.studentYear || selectedYear} • S{tx.semester || '1'}
                                                </span>
                                            </td>
                                            <td className={`py-3.5 px-4 text-right font-black ${isCon ? 'text-secondary' : 'text-success'}`}>
                                                ₹{formatNumber(tx.amount)}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="py-6 text-center text-muted-text text-xs">
                                        No transaction records found for Year {selectedYear}.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card List View for Transactions */}
                <div className="md:hidden divide-y divide-border p-3 sm:p-4 space-y-3">
                    {currentYearTransactions.length > 0 ? (
                        currentYearTransactions.map((tx, idx) => {
                            const txDate = tx.paymentDate ? new Date(tx.paymentDate) : null;
                            const dateStr = txDate
                                ? txDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '—';
                            const isCon = tx.transactionType === 'CREDIT' || isCredit(tx);

                            return (
                                <div key={tx._id || idx} className="pt-3 first:pt-0">
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <div>
                                            <p className="font-bold text-main text-xs">
                                                {tx.feeHead?.name || (isCon ? 'Scholarship / Concession' : 'Fee Payment')}
                                            </p>
                                            <p className="text-[10px] text-muted-text mt-0.5">{dateStr}</p>
                                        </div>
                                        <p className={`font-black text-sm shrink-0 ${isCon ? 'text-secondary' : 'text-success'}`}>
                                            ₹{formatNumber(tx.amount)}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <span className="px-2 py-0.5 rounded border border-border bg-background text-[10px] font-bold text-sub">
                                            {tx.paymentMode || 'Cash'}
                                        </span>
                                        {tx.receiptNumber && (
                                            <span className="px-2 py-0.5 rounded border border-[var(--primary-light)] bg-[var(--primary-light)] text-[10px] font-mono font-bold text-primary">
                                                {tx.receiptNumber}
                                            </span>
                                        )}
                                        <span className="text-[10px] text-muted-text font-semibold">
                                            Y{tx.studentYear || selectedYear} • S{tx.semester || '1'}
                                        </span>
                                        {(tx.referenceNo || tx.gatewayPaymentId) && (
                                            <span className="text-[10px] font-mono text-muted-text">
                                                {tx.referenceNo || tx.gatewayPaymentId}
                                            </span>
                                        )}
                                    </div>

                                    {tx.remarks && (
                                        <p className="text-[10px] text-muted-text italic mt-1.5 bg-background p-1.5 rounded-lg border border-border">
                                            "{tx.remarks}"
                                        </p>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <p className="text-center text-muted-text text-xs py-6">
                            No transaction records found for Year {selectedYear}.
                        </p>
                    )}
                </div>
            </div>

            {/* Online Payment Modal */}
            {paymentModalOpen && paymentTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--sidebar)]/60 backdrop-blur-xs animate-fade-in">
                    <div className="bg-surface rounded-2xl max-w-md w-full shadow-2xl border border-border overflow-hidden transform transition-all">
                        {/* Modal Header */}
                        <div className="p-4 sm:p-5 bg-gradient-to-r from-primary to-primary text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-[var(--surface)]/10 rounded-xl backdrop-blur-xs">
                                    <CreditCard size={18} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-bold leading-tight">Pay Fees Online</h3>
                                    <p className="text-[10px] sm:text-[11px] text-primary">Pydah Payment Gateway • Hosted Checkout</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={isProcessingPayment}
                                onClick={() => setPaymentModalOpen(false)}
                                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-[var(--surface)]/10 transition cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 sm:p-6 space-y-4">
                            {/* Details Summary Card */}
                            <div className="bg-background rounded-xl p-3.5 border border-border space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-muted-text">Fee Description</div>
                                        <div className="text-xs sm:text-sm font-bold text-main">{paymentTarget.title}</div>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--primary-light)] text-primary border border-[var(--primary-light)] shrink-0">
                                        Year {paymentTarget.studentYear}
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-xs">
                                    <div>
                                        <div className="text-[9px] uppercase font-semibold text-muted-text">Total</div>
                                        <div className="font-bold text-sub">₹{formatNumber(paymentTarget.totalFee)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] uppercase font-semibold text-muted-text">Paid</div>
                                        <div className="font-bold text-success">₹{formatNumber(paymentTarget.paid)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] uppercase font-bold text-muted-text">Balance Due</div>
                                        <div className="font-extrabold text-danger">₹{formatNumber(paymentTarget.balance)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Amount Input */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-sub flex items-center justify-between">
                                    <span>Amount to Pay</span>
                                    <span className="text-[10px] font-normal text-muted-text">INR (₹)</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-muted-text text-sm">₹</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max={paymentTarget.balance}
                                        value={payAmountInput}
                                        onChange={(e) => setPayAmountInput(e.target.value)}
                                        disabled={isProcessingPayment}
                                        placeholder="Enter amount"
                                        className="w-full pl-8 pr-4 py-2.5 text-base font-bold text-main bg-surface border border-border-strong rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                                    />
                                </div>

                                {/* Quick Amount Pills */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setPayAmountInput(String(paymentTarget.balance))}
                                        className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-[var(--primary-light)] bg-[var(--primary-light)] text-primary hover:bg-[var(--primary-light)] transition cursor-pointer"
                                    >
                                        Full Balance (₹{formatNumber(paymentTarget.balance)})
                                    </button>
                                    {paymentTarget.t1DueNum > 0 && paymentTarget.t1DueNum < paymentTarget.balance && (
                                        <button
                                            type="button"
                                            onClick={() => setPayAmountInput(String(paymentTarget.t1DueNum))}
                                            className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-border bg-surface text-sub hover:bg-background transition cursor-pointer"
                                        >
                                            Term 1 (₹{formatNumber(paymentTarget.t1DueNum)})
                                        </button>
                                    )}
                                    {paymentTarget.t2DueNum > 0 && paymentTarget.t2DueNum < paymentTarget.balance && (
                                        <button
                                            type="button"
                                            onClick={() => setPayAmountInput(String(paymentTarget.t2DueNum))}
                                            className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-border bg-surface text-sub hover:bg-background transition cursor-pointer"
                                        >
                                            Term 2 (₹{formatNumber(paymentTarget.t2DueNum)})
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Actions */}
                        <div className="p-4 sm:px-6 bg-[var(--background)]/80 border-t border-border flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                disabled={isProcessingPayment}
                                onClick={() => setPaymentModalOpen(false)}
                                className="px-4 py-2 text-xs font-semibold text-sub hover:bg-[var(--background)]/60 rounded-xl transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isProcessingPayment || !payAmountInput || Number(payAmountInput) <= 0}
                                onClick={handleConfirmPayment}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow transition transform active:scale-95 cursor-pointer"
                            >
                                {isProcessingPayment ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-surface border-t-transparent rounded-full animate-spin"></div>
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        <CreditCard size={14} />
                                        <span>Proceed to Checkout (₹{formatNumber(payAmountInput || 0)})</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FeeManagement;
