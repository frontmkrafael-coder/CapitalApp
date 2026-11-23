import React, { useState } from 'react';

export const LogoIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <path d="M12 13.5L3 8.5V18.5L12 23.5V13.5Z" fill="currentColor" fillOpacity="0.4" />
        <path d="M12 13.5L21 8.5V18.5L12 23.5V13.5Z" fill="currentColor" fillOpacity="0.1" />
        <path d="M12 2.5L21 8.5L12 13.5L3 8.5L12 2.5Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <img
      src="/capitalyx-icon.png"
      alt="Capitalyx"
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
      className={`rounded-[24%] object-cover select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
};
