"use client";
import { NavLink } from "@/lib/client/nav";

export default function Header({ active }: { active: "search" | "results" }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <NavLink to={{ name: "plan" }} className="brand">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <rect width="28" height="28" rx="7" fill="#1D4ED8" />
            <path d="M7 17l5-1.5L17 8l2 1-3.5 7.5 5.5-1.5 1 1.5-8.5 3.5-5 1z" fill="#FFFFFF" />
          </svg>
          Bundle Finder
        </NavLink>
        <nav aria-label="Main" className="nav">
          <NavLink to={{ name: "plan" }} className={active === "search" ? "active" : ""}>New search</NavLink>
          <NavLink to={{ name: "results" }} className={active === "results" ? "active" : ""}>Latest results</NavLink>
        </nav>
      </div>
    </header>
  );
}
