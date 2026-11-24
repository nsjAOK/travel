"use client";
import { use } from "react";
import WebApp from "@/components/WebApp";
import GuideView from "@/components/views/GuideView";

export default function Page({ params }: { params: Promise<{ rank: string }> }) {
  const { rank } = use(params);
  return (
    <WebApp>
      <GuideView rank={Number(rank)} />
    </WebApp>
  );
}
