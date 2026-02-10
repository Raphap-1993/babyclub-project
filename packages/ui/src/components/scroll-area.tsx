import * as React from "react"
import { cn } from "../utils"

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  maxHeight?: string
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, maxHeight = "400px", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent",
          className
        )}
        style={{ maxHeight }}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }
