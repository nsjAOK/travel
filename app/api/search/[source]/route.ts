import { NextResponse } from "next/server";
import { runSource } from "@/lib/adapters";
import type { Criteria, Membership } from "@/lib/types";

export async function POST(req: Request, ctx: { params: Promise<{ source: string }> }) {
  const { source } = await ctx.params;
  const { criteria, memberships } = (await req.json()) as { criteria: Criteria; memberships: Membership[] };
  try {
    return NextResponse.json(await runSource(source, criteria, memberships));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
