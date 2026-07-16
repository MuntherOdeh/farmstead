import type { Metadata } from "next";
import { ArrowLeftRight } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const metadata: Metadata = { title: "Transactions" };

export default function TransactionsPage() {
  return (
    <Empty className="min-h-[60vh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ArrowLeftRight />
        </EmptyMedia>
        <EmptyTitle>No transactions yet</EmptyTitle>
        <EmptyDescription>
          Every sale, purchase, birth, death and expense in one filterable
          ledger. Arrives with the database milestone.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
