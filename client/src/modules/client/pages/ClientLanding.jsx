// /modules/client/pages/ClientLanding.jsx
import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import ReportsPage from './ReportsPage';
import OnboardingPresentation from './OnboardingPresentation';

const stripePromise = loadStripe('pk_test_51IW8vEB2VVReBGDXnn7GYjL07pPE17sztxLahJGlDPNmXVGfqOybM4hNUHWRUQ1c3zqNkojS7lfhxmJJv9oEpw61008pPpVBNs');

export default function ClientLanding() {
  const { clientId, onboardingStep } = useOutletContext();

  // Debug logging to see what's coming in
  console.log('ClientLanding Debug — clientId:', clientId);
  console.log('ClientLanding Debug — onboardingStep:', onboardingStep);

  // Define completion logic here but keep raw value available
  const onboardingComplete = useMemo(() => {
    // treat 99 or boolean true as complete, but don't mutate original
    return onboardingStep === 99 || onboardingStep === '99' || onboardingStep === true;
  }, [onboardingStep]);

  console.log('ClientLanding Debug — onboardingComplete:', onboardingComplete);

  if (!clientId) return null;

  return onboardingComplete ? (
    <ReportsPage clientId={clientId} />
  ) : (
    <Elements stripe={stripePromise}>
      <OnboardingPresentation
        clientId={clientId}
        onboardingStep={onboardingStep}
        onFinish={() => {
          /* optional callback */
        }}
      />
    </Elements>
  );
}
