import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function Frame({
  children,
  className,
  dock = false,
}: {
  children: ReactNode;
  className?: string;
  dock?: boolean;
}) {
  return (
    <div className={cn("mx-auto flex min-h-dvh w-full max-w-md flex-col bg-paper text-ink", dock && "dock-pad", className)}>
      {children}
    </div>
  );
}

export function BootScreen() {
  return (
    <Frame>
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="font-display text-4xl tracking-tight">English Cards</p>
      </main>
    </Frame>
  );
}

export function ProblemScreen({ message }: { message: string }) {
  return (
    <Frame>
      <main className="flex flex-1 flex-col justify-center px-6">
        <h1 className="font-display text-4xl tracking-tight text-balance">Cards stayed shut</h1>
        <p className="mt-3 text-pretty text-muted">{message}</p>
      </main>
    </Frame>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 text-base font-medium text-paper",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-medium text-ink",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
