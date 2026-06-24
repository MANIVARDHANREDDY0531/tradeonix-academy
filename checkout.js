const plans = {
  'beginner-3-month': {
    name: 'Complete Beginner Trader Blueprint',
    label: '3 Month Access',
    price: 8999,
    description: 'Start with market structure, setups, entries, exits, and disciplined risk control.',
    features: ['Live classes', 'Recorded video lessons', 'Weekly live market room', '3 months course access']
  },
  'beginner-6-month': {
    name: 'Complete Beginner Trader Blueprint',
    label: '6 Month Access',
    price: 13999,
    description: 'Get the complete beginner-to-intermediate program with more time to learn and revise.',
    features: ['Live classes', 'Recorded video lessons', 'Weekly live market room', '6 months course access']
  },
  'trading-masterclass': {
    name: 'Trading MasterClass',
    label: '3 Month Validity',
    price: 24999,
    description: 'A complete market education across trading, psychology, risk, investing, and precious metals.',
    features: ['Market basics', 'Beginner psychology', 'Risk management', 'SIP', 'Gold and silver investments', 'Live support', 'Personal assistance']
  },
  consultation: {
    name: 'Course Selection Consultation',
    label: 'Guidance Call',
    price: 0,
    description: 'Share your goals and the team will help you choose the right program.',
    features: ['Course guidance', 'Batch information', 'Personal follow-up']
  }
};

const params = new URLSearchParams(window.location.search);
const planId = params.get('plan') || 'beginner-6-month';
const plan = plans[planId] || plans['beginner-6-month'];
const endpoint = window.location.protocol === 'file:'
  ? 'http://127.0.0.1:8773'
  : '';

const planName = document.querySelector('#planName');
const planDescription = document.querySelector('#planDescription');
const planPrice = document.querySelector('#planPrice');
const planFeatures = document.querySelector('#planFeatures');
const planInput = document.querySelector('#planId');
const form = document.querySelector('#checkoutPageForm');
const statusText = document.querySelector('#checkoutPageStatus');
const successView = document.querySelector('#successView');
const successText = document.querySelector('#successText');
const couponCodeInput = document.querySelector('#couponCode');
const applyCouponButton = document.querySelector('#applyCoupon');
const couponMessage = document.querySelector('#couponMessage');
const couponSummary = document.querySelector('#couponSummary');
const couponDiscount = document.querySelector('#couponDiscount');
const finalPrice = document.querySelector('#finalPrice');

let appliedCoupon = null;
let currentPayableAmount = plan.price * 100;

function formatAmount(amount) {
  if (!Number(amount)) return 'Free consultation';
  return `Rs. ${Number(amount).toLocaleString('en-IN')}`;
}

function formatPaise(amount) {
  return formatAmount(Number(amount || 0) / 100);
}

function resetCouponView(message = '') {
  appliedCoupon = null;
  currentPayableAmount = plan.price * 100;
  couponSummary.hidden = true;
  couponDiscount.textContent = '- Rs. 0';
  finalPrice.textContent = formatAmount(plan.price);
  planPrice.textContent = formatAmount(plan.price);
  couponMessage.classList.remove('error');
  couponMessage.textContent = message;
}

function showCouponError(message) {
  resetCouponView();
  couponMessage.classList.add('error');
  couponMessage.textContent = message;
}

async function applyCoupon() {
  const couponCode = couponCodeInput.value.trim();
  if (!couponCode) {
    resetCouponView('Enter a coupon code to apply.');
    return;
  }
  if (!plan.price) {
    showCouponError('Coupons are only available for paid plans.');
    return;
  }

  couponMessage.classList.remove('error');
  couponMessage.textContent = 'Checking coupon...';
  applyCouponButton.disabled = true;
  try {
    const query = new URLSearchParams({ planId, couponCode });
    const response = await fetch(`${endpoint}/api/validate-coupon?${query.toString()}`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Coupon could not be applied.');

    appliedCoupon = result.coupon;
    currentPayableAmount = result.payableAmount;
    couponSummary.hidden = false;
    couponDiscount.textContent = `- ${formatPaise(result.discountAmount)}`;
    finalPrice.textContent = formatPaise(result.payableAmount);
    planPrice.textContent = formatPaise(result.payableAmount);
    couponMessage.textContent = `${result.coupon.code} applied successfully.`;
  } catch (error) {
    showCouponError(error.message || 'Coupon could not be applied.');
  } finally {
    applyCouponButton.disabled = false;
  }
}

planName.textContent = plan.name;
planDescription.textContent = `${plan.label}. ${plan.description}`;
planPrice.textContent = formatAmount(plan.price);
finalPrice.textContent = formatAmount(plan.price);
planInput.value = planId;
planFeatures.innerHTML = plan.features.map((feature) => `<li>${feature}</li>`).join('');

applyCouponButton?.addEventListener('click', applyCoupon);
couponCodeInput?.addEventListener('input', () => {
  if (!couponCodeInput.value.trim()) {
    resetCouponView();
    planPrice.textContent = formatAmount(plan.price);
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector('button[type="submit"]');
  statusText.textContent = plan.price ? 'Creating secure payment order...' : 'Submitting your enrollment...';
  submitButton.disabled = true;

  try {
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.amount = currentPayableAmount;
    payload.currency = 'INR';

    if (!plan.price) {
      const freeResponse = await fetch(`${endpoint}/api/purchase-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const freeResult = await freeResponse.json();
      if (!freeResponse.ok) throw new Error(freeResult.error || 'Unable to submit request.');
      successText.textContent = `Reference ${freeResult.referenceId}. The team will contact you shortly.`;
      successView.setAttribute('aria-hidden', 'false');
      form.reset();
      return;
    }

    if (!window.Razorpay) {
      throw new Error('Razorpay checkout could not load. Please check your internet connection and try again.');
    }

    const response = await fetch(`${endpoint}/api/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to create payment order.');

    if (result.discountAmount) {
      currentPayableAmount = result.payableAmount;
      couponSummary.hidden = false;
      couponDiscount.textContent = `- ${formatPaise(result.discountAmount)}`;
      finalPrice.textContent = formatPaise(result.payableAmount);
      planPrice.textContent = formatPaise(result.payableAmount);
    }

    statusText.textContent = 'Opening Razorpay checkout...';
    const options = {
      key: result.key_id,
      amount: result.amount,
      currency: result.currency,
      name: 'TRADEONIX ACADEMY',
      description: `${plan.name} - ${plan.label}`,
      order_id: result.order_id,
      prefill: {
        name: payload.name,
        email: payload.email,
        contact: payload.phone
      },
      notes: {
        referenceId: result.referenceId,
        planId,
        couponCode: result.coupon?.code || ''
      },
      theme: {
        color: '#f7c85b'
      },
      modal: {
        ondismiss() {
          statusText.textContent = 'Payment was cancelled. You can click Pay with Razorpay to try again.';
          submitButton.disabled = false;
        }
      },
      async handler(paymentResponse) {
        statusText.textContent = 'Verifying payment...';
        try {
          const verifyResponse = await fetch(`${endpoint}/api/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              referenceId: result.referenceId,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_signature: paymentResponse.razorpay_signature
            })
          });
          const verifyResult = await verifyResponse.json();
          if (!verifyResponse.ok) throw new Error(verifyResult.error || 'Payment verification failed.');
          successText.textContent = `Payment successful. Reference ${result.referenceId}. Paid ${formatPaise(result.payableAmount || result.amount)}.`;
          successView.setAttribute('aria-hidden', 'false');
          form.reset();
          resetCouponView();
          planPrice.textContent = formatAmount(plan.price);
          statusText.textContent = '';
        } catch (error) {
          statusText.textContent = error.message || 'Payment verification failed.';
        } finally {
          submitButton.disabled = false;
        }
      }
    };

    const razorpay = new Razorpay(options);
    razorpay.on('payment.failed', (failure) => {
      const description = failure.error?.description || 'Payment failed. Please try again.';
      statusText.textContent = description;
      submitButton.disabled = false;
    });
    razorpay.open();
  } catch (error) {
    statusText.textContent = error.message || 'Please try again.';
    submitButton.disabled = false;
  } finally {
    if (!plan.price) submitButton.disabled = false;
  }
});
