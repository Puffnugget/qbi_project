interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  padding?: "none" | "sm" | "md";
}

const paddingMap = {
  none: "",
  sm: "p-3",
  md: "p-4",
};

export function Card({
  children,
  className = "",
  elevated = false,
  padding = "md",
}: CardProps) {
  return (
    <div
      className={`card ${elevated ? "card-elevated" : ""} ${paddingMap[padding]} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between border-b border-border px-4 py-2 ${className}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`card flex items-center justify-center text-sm text-fg-muted ${className}`}
    >
      {children}
    </div>
  );
}
