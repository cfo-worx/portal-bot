// src/components/Shared/Button.jsx
import React from 'react';

export const Button = ({ children, onClick, type = 'button', className = '' }) => {
  const baseStyles = 'bg-blue-500 hover:bg-blue-700 text-white font-medium py-1 px-3 rounded text-sm';
  
  // Variants based on className or additional props
  return (
    <button
      type={type}
      onClick={onClick}
      className={`${baseStyles} ${className}`}
    >
      {children}
    </button>
  );
};
