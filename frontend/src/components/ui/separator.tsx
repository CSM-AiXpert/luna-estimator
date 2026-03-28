import * as React from "react"

const Separator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }
>(({ className, orientation = "horizontal", ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    {...props}
    style={{
      ...props.style,
      width: orientation === "horizontal" ? "100%" : "1px",
      height: orientation === "vertical" ? "100%" : "1px",
      background: "#31333f",
      flexShrink: 0,
    }}
    className={className}
  />
))
Separator.displayName = "Separator"

export { Separator }
