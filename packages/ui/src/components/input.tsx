import React from 'react';
import { cn } from '../utils';

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    error?: string;
    label?: string;
  }
>(({ className, type, error, label, ...props }, ref) => (
  <div className="flex flex-col gap-1">
    {label && (
      <label className="text-sm font-medium text-gray-900">{label}</label>
    )}
    <input
      type={type}
      className={cn(
        'flex h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-base placeholder:text-gray-400 transition-colors focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
        error && 'border-red-500 focus:ring-red-200',
        className
      )}
      ref={ref}
      {...props}
    />
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
));

Input.displayName = 'Input';

export { Input };
