import type { Metadata } from "next";
import { ChartLine } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  await requireUser();
  return (
    <Empty className="min-h-[60vh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ChartLine />
        </EmptyMedia>
        <EmptyTitle>Analytics needs data first</EmptyTitle>
        <EmptyDescription>
          Herd reconciliation, margins, yields and the pivot builder land in
          Milestone 7, once real transactions exist to analyse.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
