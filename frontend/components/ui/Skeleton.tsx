"use client";

import type { CSSProperties } from "react";

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={`animate-pulse rounded-md bg-canvas-deep/70 ${className}`}
    />
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

export function LoadingState({
  message,
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 text-sm text-fg-muted ${className}`}
    >
      <Spinner className="size-5 text-accent" />
      {message && <p>{message}</p>}
    </div>
  );
}

export function SceneSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-xl border border-border bg-scene-bg/40 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="relative flex flex-1 items-center justify-center p-6">
        <div className="grid grid-cols-4 gap-6 opacity-60">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              className="size-3 rounded-full"
              style={{
                marginTop: `${(i % 3) * 8}px`,
                marginLeft: `${(i % 4) * 4}px`,
              }}
            />
          ))}
        </div>
        <LoadingState
          message="Loading 3D embedding…"
          className="absolute inset-0 bg-scene-bg/20 backdrop-blur-[1px]"
        />
      </div>
    </div>
  );
}

export function ChartSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-2 ${className}`}>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="min-h-[5rem] flex-1 rounded-lg" />
    </div>
  );
}

export function SelectionLogSkeleton() {
  return (
    <div className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface/80 p-3">
      <Skeleton className="h-3 w-32" />
      <div className="grid flex-1 grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function ExploreViewSkeleton() {
  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_10rem_8.5rem] gap-0 overflow-hidden">
      <div className="min-h-0 p-3 pb-2">
        <SceneSkeleton className="h-full" />
      </div>
      <div className="grid min-h-0 shrink-0 grid-cols-2 gap-3 border-t border-border bg-surface/60 px-3 py-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <div className="min-h-0 px-3 pb-3">
        <SelectionLogSkeleton />
      </div>
    </div>
  );
}

export function ComparePanelSkeleton({ label }: { label?: string }) {
  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-xl border border-border bg-scene-bg/30">
      {label && (
        <p className="absolute left-3 top-3 z-10 rounded-md border border-border bg-surface-elevated px-2 py-0.5 text-xs font-medium text-fg-muted">
          {label}
        </p>
      )}
      <LoadingState message="Loading panel…" className="h-full" />
    </div>
  );
}

export function FolkloreTabSkeleton() {
  return (
    <div className="relative grid h-full min-h-0 grid-rows-[minmax(0,1fr)_14rem] gap-3 overflow-hidden p-3">
      <div className="grid min-h-0 gap-3 xl:grid-cols-[19rem_minmax(0,1fr)_22rem]">
        <Skeleton className="min-h-0 rounded-xl" />
        <Skeleton className="min-h-0 rounded-xl" />
        <Skeleton className="min-h-0 rounded-xl" />
      </div>
      <Skeleton className="min-h-0 rounded-xl" />
      <LoadingState
        message="Loading preset demos…"
        className="pointer-events-none absolute inset-0 bg-canvas/40"
      />
    </div>
  );
}

export function LiveEditorSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-20 rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-10 rounded-md" />
    </div>
  );
}
