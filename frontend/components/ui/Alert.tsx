"use client";

type AlertVariant = "error" | "success" | "warning" | "info";

const variantStyles: Record<AlertVariant, string> = {
  error: "border-danger/35 bg-danger/8 text-danger",
  success: "border-success/35 bg-success/8 text-success",
  warning: "border-warning/35 bg-warning/10 text-warning",
  info: "border-accent/25 bg-accent/6 text-fg-muted",
};

const titleByVariant: Record<AlertVariant, string> = {
  error: "Something went wrong",
  success: "Success",
  warning: "Heads up",
  info: "Note",
};

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function Alert({
  variant = "error",
  title,
  children,
  onRetry,
  retryLabel = "Try again",
  className = "",
}: AlertProps) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`card flex flex-col gap-2 px-4 py-3 text-sm ${variantStyles[variant]} ${className}`}
    >
      <p className="font-medium">{title ?? titleByVariant[variant]}</p>
      <div className="leading-relaxed opacity-90">{children}</div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-ghost mt-1 w-fit px-3 py-1.5 text-xs font-medium"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
