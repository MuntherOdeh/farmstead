import type { Metadata } from "next";
import { Package } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <Empty className="min-h-[60vh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Package />
        </EmptyMedia>
        <EmptyTitle>No products yet</EmptyTitle>
        <EmptyDescription>
          The catalogue — livestock, dairy, honey, wool and everything else,
          with your own categories, units and custom fields. Arrives in
          Milestone 4.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
