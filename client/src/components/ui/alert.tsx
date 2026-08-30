import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertCircle, X } from "lucide-react"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm flex items-start gap-3",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border-border",
        destructive:
          "border-destructive/40 bg-destructive/10 text-destructive [&>svg]:text-destructive",
        error: "border-destructive/40 bg-destructive/10 text-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof alertVariants> & { onClose?: () => void }
>(({ className, variant, children, onClose, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  >
    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
    <div className="flex-1 break-words">{children}</div>
    {onClose && (
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="shrink-0 text-destructive/70 hover:text-destructive transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
))
Alert.displayName = "Alert"

export { Alert, alertVariants }