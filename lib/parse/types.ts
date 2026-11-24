import type { Criteria } from "@/lib/types";

export type ParseResult = { criteria: Criteria; reader: "claude" | "built-in"; warning?: string };
