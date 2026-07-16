import type { Metadata } from "next";
import { Users } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Parties" };

export default async function PartiesPage() {
  await requireUser();
  return (
    <Empty className="min-h-[60vh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Users />
        </EmptyMedia>
        <EmptyTitle>No customers or suppliers yet</EmptyTitle>
        <EmptyDescription>
          Everyone you buy from and sell to, with their history and totals.
          Arrives with the database milestone.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
