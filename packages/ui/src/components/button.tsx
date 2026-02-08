import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800 focus-visible:ring-purple-500',
        secondary:
          'bg-gray-200 text-gray-900 hover:bg-gray-300 active:bg-gray-400 focus-visible:ring-gray-500',
        accent:
          'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 focus-visible:ring-teal-500',
        outline:
          'border-2 border-gray-300 bg-transparent text-gray-900 hover:bg-gray-50 active:bg-gray-100 focus-visible:ring-gray-500',
        ghost: 'bg-transparent text-gray-900 hover:bg-gray-100 active:bg-gray-200',
        danger:
          'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500',
        success:
          'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 focus-visible:ring-green-500',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Cargando...
        </>
      ) : (
        children
      )}
    </button>
  )
);

Button.displayName = 'Button';

export { Button, buttonVariants };
export type { ButtonProps };
