import { cn } from "@crikket/ui/lib/utils"

interface ShellProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Shell({ children, className, ...props }: ShellProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-4 overflow-auto p-4 pt-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
