import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-[#a60c2f]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
  {
    variants: {
      variant: {
        default: "border border-[#861128] bg-[#a60c2f] text-white hover:bg-[#8f0a28]",
        ghost: "border border-[#2b2b2b] bg-[#151515] text-white/90 hover:bg-[#1c1c1c] hover:border-[#3a3a3a]",
        outline: "border border-[#2b2b2b] bg-[#121212] text-white/90 hover:bg-[#1a1a1a] hover:border-[#3a3a3a]",
        danger: "border border-red-500/40 bg-red-500/10 text-red-200 hover:border-red-400 hover:bg-red-500/20",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-4",
        lg: "h-11 px-5",
        icon: "h-8 w-8 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => {
  return <button className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
