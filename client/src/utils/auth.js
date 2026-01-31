// frontend/src/utils/auth.js

/**
 * Decodes a JWT token and returns its payload.
 * Note: This does not verify the token's signature or validity.
 *
 * @param {string} token - The JWT token to decode.
 * @returns {Object|null} - The decoded payload or null if invalid.
 */
export const decodeToken = (token) => {
  try {
    if (!token) {
      throw new Error('Token is required for decoding.');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token format.');
    }

    const payload = parts[1];
    // base64url decode
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const jsonPayload = decodeURIComponent(
      decoded
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('auth.decodeToken error:', error);
    return null;
  }
};

/**
 * Extracts user information from a JWT token.
 * Also persists the clientId (if present) into localStorage.
 *
 * @param {string} token - The JWT token.
 * @returns {Object|null} - The decoded user payload or null if invalid.
 */
export const getUserFromToken = (token) => {
  const payload = decodeToken(token);
  if (payload) {
    // Persist raw token if you need it elsewhere
    try {
      localStorage.setItem('token', token);
    } catch (e) {
      console.warn('Could not save token to localStorage:', e);
    }

    // If the payload contains clientId, store it
    if (payload.clientId) {
      try {
        localStorage.setItem('clientId', payload.clientId);
      } catch (e) {
        console.warn('Could not save clientId to localStorage:', e);
      }
    }
  }
  return payload;
};

/**
 * Clears authentication data from localStorage.
 * Call this on logout.
 */
export const clearAuth = () => {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('clientId');
  } catch (e) {
    console.warn('Could not clear auth data from localStorage:', e);
  }
};

/**
 * Retrieves the stored token from localStorage.
 *
 * @returns {string|null}
 */
export const getToken = () => {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
};

/**
 * Retrieves the stored clientId from localStorage.
 *
 * @returns {string|null}
 */
export const getClientId = () => {
  try {
    return localStorage.getItem('clientId');
  } catch {
    return null;
  }
};
