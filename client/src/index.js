// /var/www/html/client/src/index.js
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Replace with your real publishable key
const stripePromise = loadStripe('pk_test_51IW8vEB2VVReBGDXnn7GYjL07pPE17sztxLahJGlDPNmXVGfqOybM4hNUHWRUQ1c3zqNkojS7lfhxmJJv9oEpw61008pPpVBNs');

ReactDOM.render(
  <React.StrictMode>
    <AuthProvider>
      <Elements stripe={stripePromise}>
        <App />
      </Elements>
    </AuthProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
