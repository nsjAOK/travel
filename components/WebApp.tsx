"use client";
// Hosts the shared screens in the Next.js app: real URLs and the server API.
import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppProvider, type Route, type Services } from "@/lib/client/nav";

export const pathFor = (to: Route) =>
  to.name === "plan" ? "/" : to.name === "guide" ? `/results/${to.rank}` : `/${to.name}`;

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "The request failed.");
  return data as T;
}

const httpServices: Services = {
  host: "web",
  sources: async () => {
    const res = await fetch("/api/sources");
    if (!res.ok) throw new Error("Couldn't reach the app's server.");
    return res.json();
  },
  parse: (text) => post("/api/parse", { text }),
  search: (id, criteria, memberships) => post(`/api/search/${id}`, { criteria, memberships }),
};

export default function WebApp({ children }: { children: ReactNode }) {
  const router = useRouter();
  const value = useMemo(() => ({ go: (to: Route) => router.push(pathFor(to)), href: pathFor, services: httpServices }), [router]);
  return <AppProvider value={value}>{children}</AppProvider>;
}
