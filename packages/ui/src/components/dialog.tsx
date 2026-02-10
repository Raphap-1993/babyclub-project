import React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../utils';

const Dialog = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }
>(({ className, open, onOpenChange, children, ...props }, ref) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [open]);

  if (!open || !mounted) return null;

  const dialog = (
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
      />
      <div
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-700/50 bg-slate-900 shadow-2xl',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </>
  );

  return createPortal(dialog, document.body);
});

Dialog.displayName = 'Dialog';

const DialogHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('border-b border-slate-700/50 px-6 py-4', className)}
    {...props}
  />
));

DialogHeader.displayName = 'DialogHeader';

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn('text-lg font-semibold text-slate-100', className)}
    {...props}
  />
));

DialogTitle.displayName = 'DialogTitle';

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('px-6 py-4 text-slate-200', className)} {...props} />
));

DialogContent.displayName = 'DialogContent';

const DialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'border-t border-slate-700/50 px-6 py-4 flex justify-end gap-2',
      className
    )}
    {...props}
  />
));

DialogFooter.displayName = 'DialogFooter';

export {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
};
