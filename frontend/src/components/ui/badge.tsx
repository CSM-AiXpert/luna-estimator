import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#00d4ff] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-white/10 text-white/70",
        cyan: "border-transparent bg-[#00d4ff]/15 text-[#00d4ff]",
        blue: "border-transparent bg-blue-500/15 text-blue-400",
        success: "border-transparent bg-green-500/15 text-green-400",
        warning: "border-transparent bg-yellow-500/15 text-yellow-400",
        error: "border-transparent bg-red-500/15 text-red-400",
        purple: "border-transparent bg-purple-500/15 text-purple-400",
        ai: "border border-purple-500/30 bg-purple-500/15 text-purple-300",
        manual: "border border-green-500/30 bg-green-500/15 text-green-300",
        calculated: "border border-blue-500/30 bg-blue-500/15 text-blue-300",
        draft: "border border-gray-500/30 bg-gray-500/15 text-gray-400",
        pending: "border border-yellow-500/30 bg-yellow-500/15 text-yellow-400",
        sent: "border border-blue-500/30 bg-blue-500/15 text-blue-400",
        approved: "border border-green-500/30 bg-green-500/15 text-green-400",
        rejected: "border border-red-500/30 bg-red-500/15 text-red-400",
        "in-progress": "border border-cyan-500/30 bg-cyan-500/15 text-cyan-400",
        active: "border border-cyan-500/30 bg-cyan-500/15 text-cyan-400",
        completed: "border border-green-500/30 bg-green-500/15 text-green-400",
        cancelled: "border border-gray-500/30 bg-gray-500/15 text-gray-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
