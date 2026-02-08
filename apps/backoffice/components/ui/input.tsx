import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-[#2d2d2d] bg-[#161616] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none transition-all focus:border-[#a60c2f]/60 focus:ring-2 focus:ring-[#a60c2f]/18",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
