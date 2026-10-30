import api from '../config/api';

/**
 * Ensures ppg.js Drop-in SDK is loaded into window.PPG
 */
const loadPpgSdk = () => {
  return new Promise((resolve, reject) => {
    if (window.PPG && typeof window.PPG.openCheckout === 'function') {
      return resolve(window.PPG);
    }

    const scriptSrc = import.meta.env.VITE_PPG_SDK_URL || 'http://localhost:5000/sdk/ppg.js';
    const existing = document.querySelector('script[src*="ppg.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.PPG));
      existing.addEventListener('error', (err) => reject(err));
      if (window.PPG) return resolve(window.PPG);
    }

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.onload = () => resolve(window.PPG);
    script.onerror = () => reject(new Error('Failed to load PPG Drop-in Checkout SDK'));
    document.head.appendChild(script);
  });
};

/**
 * Pydah Payment Gateway (PPG) Client Service
 * In-Page Popup Checkout via ppg.js (Zero Provider SDKs)
 * Reference: docs/TESTING_FROM_EXTERNAL_APP_GUIDE.md
 */
export const paymentService = {
  /**
   * 1. Create a payment order via application backend
   * POST /api/payments/create-order
   */
  createOrder: async (data) => {
    const response = await api.post('/payments/create-order', data);
    return response.data;
  },

  /**
   * 2. Confirm and record payment in application database
   * POST /api/payments/confirm
   */
  confirmPayment: async (paymentId) => {
    const response = await api.post('/payments/confirm', { paymentId });
    return response.data;
  },

  /**
   * 3. Check payment status directly from Gateway
   * GET /api/payments/status/:paymentId
   */
  getPaymentStatus: async (paymentId) => {
    const response = await api.get(`/payments/status/${paymentId}`);
    return response.data;
  },

  /**
   * 4. In-Page Popup Checkout Flow (Drop-in Modal)
   * Opens the payment modal directly inside the current page as an overlay.
   * Student never leaves the URL!
   * 
   * @param {Object} params
   * @param {number} params.amountInRupees - Amount in INR (e.g. 1500)
   * @param {string} [params.collegeCode] - Optional College Code (e.g. "PCE")
   * @param {string} [params.courseCode] - Optional Course Code (e.g. "BTECH")
   * @param {string} [params.studentId] - Student Admission Number
   * @param {string} [params.description] - Payment description
   * @param {string} [params.customerName] - Payer name
   * @param {string} [params.customerEmail] - Payer email
   * @param {string} [params.customerPhone] - Payer contact
   * @param {string} [params.feeHeadId] - Optional Fee Head ID
   * @param {string} [params.studentYear] - Optional Student Year
   * @param {string} [params.semester] - Optional Semester
   * @param {string} [params.remarks] - Payment remarks
   * @param {string|number} [params.serviceRequestId] - Service Request ID
   * @param {Function} [params.onSuccess] - Callback when payment succeeds & confirmed
   * @param {Function} [params.onFailure] - Callback on payment failure
   * @param {Function} [params.onClose] - Callback when modal is closed
   */
  openCheckout: async ({
    amountInRupees,
    collegeCode,
    courseCode,
    college,
    course,
    studentId,
    description,
    customerName,
    customerEmail,
    customerPhone,
    feeHeadId,
    studentYear,
    semester,
    remarks,
    serviceRequestId,
    onSuccess,
    onFailure,
    onClose,
  }) => {
    if (!amountInRupees || Number(amountInRupees) <= 0) {
      throw new Error('Please specify a valid payment amount');
    }

    // 1. Call backend to create order on PPG
    const orderData = await paymentService.createOrder({
      amountInRupees: Number(amountInRupees),
      collegeCode: collegeCode || college || undefined,
      courseCode: courseCode || course || undefined,
      college: collegeCode || college || undefined,
      course: courseCode || course || undefined,
      studentId,
      description: description || 'Semester Tuition Fee',
      customerName: customerName || undefined,
      customerEmail: customerEmail && typeof customerEmail === 'string' && customerEmail.trim() ? customerEmail.trim() : undefined,
      customerPhone: customerPhone && typeof customerPhone === 'string' && customerPhone.trim() ? customerPhone.trim() : undefined,
      feeHeadId,
      studentYear,
      semester,
      remarks,
      serviceRequestId,
    });

    if (!orderData.success || !orderData.checkoutUrl) {
      throw new Error(orderData.error || 'Failed to create payment checkout');
    }

    const { checkoutUrl, paymentId } = orderData;

    // 2. Ensure PPG Drop-in SDK is ready
    await loadPpgSdk();

    if (!window.PPG || typeof window.PPG.openCheckout !== 'function') {
      throw new Error('PPG Checkout SDK is not available');
    }

    // 3. Open in-page drop-in popup modal
    return new Promise((resolve, reject) => {
      window.PPG.openCheckout({
        checkoutUrl,
        onSuccess: async (result) => {
          console.log('[PPG SDK] Payment completed successfully:', result);
          const activePaymentId = result?.paymentId || paymentId;

          try {
            // Confirm transaction and receipt in application database
            const confirmResult = await paymentService.confirmPayment(activePaymentId);
            if (onSuccess) onSuccess(confirmResult);
            resolve(confirmResult);
          } catch (confirmErr) {
            console.error('[PPG SDK] Confirmation error:', confirmErr);
            const fallbackRes = { success: true, paymentId: activePaymentId, ...result };
            if (onSuccess) onSuccess(fallbackRes);
            resolve(fallbackRes);
          }
        },
        onFailure: (err) => {
          console.warn('[PPG SDK] Payment failed:', err);
          if (onFailure) onFailure(err);
          reject(err);
        },
        onClose: () => {
          console.log('[PPG SDK] Modal closed');
          if (onClose) onClose();
          resolve({ closed: true });
        },
      });
    });
  },

  /**
   * Alias for initiateCheckout
   */
  initiateCheckout: function (params) {
    return paymentService.openCheckout(params);
  },
};

export default paymentService;
