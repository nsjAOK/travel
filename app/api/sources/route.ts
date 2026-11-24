import { NextResponse } from "next/server";
import { listSources, liveApis } from "@/lib/adapters";

export async function GET() {
  return NextResponse.json({
    sources: listSources(),
    live: liveApis(),
    claude: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE),
  });
}
