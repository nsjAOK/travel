import { NextResponse } from "next/server";
import { parseTrip } from "@/lib/parse";

export async function POST(req: Request) {
  const { text } = (await req.json()) as { text?: string };
  if (!text || text.trim().length < 10) {
    return NextResponse.json({ error: "Describe your trip in a sentence or two first." }, { status: 400 });
  }
  return NextResponse.json(await parseTrip(text.slice(0, 4000)));
}
