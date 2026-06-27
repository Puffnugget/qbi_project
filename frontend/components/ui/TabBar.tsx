"use client";

import { createContext, useContext } from "react";

interface TabsContextValue<T extends string> {
  activeTab: T;
  setActiveTab: (tab: T) => void;
}

const TabsContext = createContext<TabsContextValue<string> | undefined>(
  undefined,
);

export function Tabs<T extends string>({
  children,
  value,
  onChange,
}: {
  children: React.ReactNode;
  value: T;
  onChange: (tab: T) => void;
}) {
  return (
    <TabsContext.Provider
      value={{ activeTab: value, setActiveTab: onChange as (tab: string) => void }}
    >
      {children}
    </TabsContext.Provider>
  );
}

export function TabList({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 gap-0.5 border-b border-border px-4 pt-3 ${className}`}
      role="tablist"
    >
      {children}
    </div>
  );
}

export function Tab({
  id,
  children,
  label,
}: {
  id: string;
  children?: React.ReactNode;
  label?: string;
}) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("Tab must be used within Tabs");

  const isActive = context.activeTab === id;
  const text = label ?? children;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => context.setActiveTab(id)}
      className={`rounded-t-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
        isActive
          ? "bg-surface text-fg shadow-[inset_0_1px_0_var(--border)]"
          : "text-fg-muted hover:text-fg hover:bg-canvas-deep/60"
      }`}
    >
      {text}
    </button>
  );
}
