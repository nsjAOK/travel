"use client";
// Navigation and data access the screens use, supplied by whoever hosts them:
// the Next.js app (URLs + API routes) or the Claude artifact (hash + in-page).
import { createContext, useContext, type ReactNode } from "react";
import type { Criteria, Membership, SourceResult } from "@/lib/types";
import type { SourceInfo } from "@/lib/adapters";
import type { ParseResult } from "@/lib/parse/types";

export type Route = { name: "plan" } | { name: "search" } | { name: "results" } | { name: "guide"; rank: number };

export type Services = {
  /** Where the app runs; changes a few lines of copy. */
  host: "web" | "claude";
  sources(): Promise<{ sources: SourceInfo[]; live: boolean; claude: boolean }>;
  parse(text: string): Promise<ParseResult>;
  search(id: string, criteria: Criteria, memberships: Membership[]): Promise<SourceResult>;
};

type Ctx = { go(to: Route): void; href(to: Route): string; services: Services };

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ value, children }: { value: Ctx; children: ReactNode }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function NavLink({ to, className, style, children }: { to: Route; className?: string; style?: React.CSSProperties; children: ReactNode }) {
  const { go, href } = useApp();
  return (
    <a
      href={href(to)}
      className={className}
      style={style}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        go(to);
      }}
    >
      {children}
    </a>
  );
}
