import api from '../config/api';

/**
 * Pydah Payment Gateway (PPG) Client Service
 * Adheres to PAYMENTS_EXTERNAL_APP_GUIDE specifications
 */
export const paymentService = {
  /**
   * 1. Create a payment order via application backend
   * POST /api/payments/create
   */
  createOrder: async (data) => {
    const response = await api.post('/payments/create', data);
    return response.data;
  },

  /**
   * 2. Verify payment signature with backend and PPG
   * POST /api/payments/verify/:paymentId
   */
  verifyPayment: async (paymentId, verificationData) => {
    const url = paymentId ? `/payments/verify/${paymentId}` : '/payments/verify';
    const response = await api.post(url, verificationData);
    return response.data;
  },

  /**
   * 3. Check payment status
   * GET /api/payments/status/:paymentId
   */
  getPaymentStatus: async (paymentId) => {
    const response = await api.get(`/payments/status/${paymentId}`);
    return response.data;
  },

  /**
   * 4. Full End-to-End Checkout Flow
   * Initiates payment order, pops the Razorpay modal, and verifies the cryptographic signature
   * 
   * @param {Object} params
   * @param {number} params.amountInRupees - Payment amount in INR (e.g. 1500)
   * @param {string} [params.studentId] - Student Admission Number
   * @param {string} [params.description] - Payment description
   * @param {string} [params.customerName] - Payer name
   * @param {string} [params.customerEmail] - Payer email
   * @param {string} [params.customerPhone] - Payer contact
   * @param {string} [params.feeHeadId] - Optional Fee Head ID
   * @param {string} [params.studentYear] - Optional Student Year
   * @param {string} [params.semester] - Optional Semester
   * @param {string} [params.remarks] - Payment remarks
   * @param {string|number} [params.serviceRequestId] - Service Request ID if paying for a certificate/service
   * @param {Function} [params.onSuccess] - Callback when payment and verification succeed
   * @param {Function} [params.onError] - Callback on error
   * @param {Function} [params.onDismiss] - Callback if checkout modal is closed
   */
  initiateCheckout: async ({
    amountInRupees,
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
    onError,
    onDismiss,
    themeColor = '#4f46e5',
  }) => {
    try {
      if (!amountInRupees || Number(amountInRupees) <= 0) {
        throw new Error('Please specify a valid payment amount');
      }

      // Step 1: Request order creation from backend
      const createResponse = await paymentService.createOrder({
        amountInRupees: Number(amountInRupees),
        studentId,
        description: description || 'Pydah Application Fee Payment',
        customerName: customerName || undefined,
        customerEmail: customerEmail && typeof customerEmail === 'string' && customerEmail.trim() ? customerEmail.trim() : undefined,
        customerPhone: customerPhone && typeof customerPhone === 'string' && customerPhone.trim() ? customerPhone.trim() : undefined,
        feeHeadId,
        studentYear,
        semester,
        remarks,
        serviceRequestId,
      });

      if (!createResponse.success) {
        throw new Error(createResponse.error || 'Failed to create payment order');
      }

      const { paymentId, checkout, order, key_id, studentDetails } = createResponse;

      // Extract checkout options provided by PPG or fallback
      const rzpKeyId = checkout?.keyId || key_id;
      const rzpOrderId = checkout?.orderId || order?.id;
      const rzpAmount = checkout?.amount || (order?.amount ? order.amount : Math.round(Number(amountInRupees) * 100));
      const rzpCurrency = checkout?.currency || order?.currency || 'INR';
      const rzpName = checkout?.name || 'Pydah Education Academy';
      const rzpDescription = checkout?.description || description || 'Fee Payment';
      const rzpPrefill = checkout?.prefill || {
        name: customerName || studentDetails?.name || '',
        email: customerEmail || studentDetails?.email || '',
        contact: customerPhone || studentDetails?.contact || '',
      };

      if (!window.Razorpay) {
        throw new Error('Razorpay Checkout SDK is not loaded. Please check your internet connection.');
      }

      return new Promise((resolve, reject) => {
        // Step 2: Configure Razorpay Checkout options
        const options = {
          key: rzpKeyId,
          amount: rzpAmount,
          currency: rzpCurrency,
          name: rzpName,
          description: rzpDescription,
          order_id: rzpOrderId,
          prefill: rzpPrefill,
          theme: { color: themeColor },
          modal: {
            ondismiss: () => {
              if (onDismiss) onDismiss();
              resolve({ cancelled: true });
            },
          },
          handler: async (response) => {
            try {
              // Step 3: Verify signature with backend
              const verifyPayload = {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                paymentId,
                studentId,
                amount: Number(amountInRupees),
                feeHeadId,
                studentYear,
                semester,
                remarks,
                serviceRequestId,
              };

              const verifyResponse = await paymentService.verifyPayment(paymentId, verifyPayload);

              if (verifyResponse.success) {
                if (onSuccess) onSuccess(verifyResponse);
                resolve({ success: true, ...verifyResponse });
              } else {
                const errMsg = verifyResponse.error || 'Payment signature verification failed';
                if (onError) onError(new Error(errMsg));
                reject(new Error(errMsg));
              }
            } catch (verifyErr) {
              const errMsg = verifyErr.response?.data?.error || verifyErr.message || 'Verification error';
              if (onError) onError(new Error(errMsg));
              reject(new Error(errMsg));
            }
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          const failureErr = new Error(resp.error?.description || 'Payment was declined or failed');
          if (onError) onError(failureErr);
          reject(failureErr);
        });

        rzp.open();
      });
    } catch (err) {
      if (onError) onError(err);
      throw err;
    }
  },
};

export default paymentService;

