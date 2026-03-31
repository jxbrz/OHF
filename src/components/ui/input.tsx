import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-xl border border-input/90 bg-background/70 px-3 py-2 text-base font-medium text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-[background-color,border-color,box-shadow,color] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:font-normal placeholder:text-muted-foreground/55 caret-primary hover:border-foreground/20 hover:bg-background/85 focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:border-border/80 dark:bg-background/45 dark:hover:bg-background/60 dark:focus-visible:bg-background/70 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&:not(:placeholder-shown)]:border-foreground/15 [&:not(:placeholder-shown)]:bg-secondary/25",
        className
      )}
      {...props}
    />
  )
}

export { Input }
