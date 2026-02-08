import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectNativeProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const SelectNative = React.forwardRef<HTMLSelectElement, SelectNativeProps>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-[#2d2d2d] bg-[#161616] px-3 py-2 text-sm text-white outline-none transition-all focus:border-[#a60c2f]/60 focus:ring-2 focus:ring-[#a60c2f]/18",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
SelectNative.displayName = "SelectNative";

export { SelectNative };
