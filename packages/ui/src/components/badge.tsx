import React from 'react';
import { cn } from '../utils';

const Badge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  }
>(({ className, variant = 'default', ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
      variant === 'default' && 'bg-purple-100 text-purple-800',
      variant === 'secondary' && 'bg-gray-100 text-gray-800',
      variant === 'success' && 'bg-green-100 text-green-800',
      variant === 'warning' && 'bg-yellow-100 text-yellow-800',
      variant === 'error' && 'bg-red-100 text-red-800',
      variant === 'info' && 'bg-blue-100 text-blue-800',
      className
    )}
    {...props}
  />
));

Badge.displayName = 'Badge';

export { Badge };
