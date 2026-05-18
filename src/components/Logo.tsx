import React from 'react';

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <img 
      src="/logo.png" 
      alt="Logo" 
      className={className}
      referrerPolicy="no-referrer"
    />
  );
}
