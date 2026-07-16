import type { Metadata } from "next";
import { Upload } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <Empty className="min-h-[60vh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Upload />
        </EmptyMedia>
        <EmptyTitle>No imports yet</EmptyTitle>
        <EmptyDescription>
          Drop any sales spreadsheet here and Farmstead will read it, work out
          what each column means, and build a dashboard from it. The import
          engine arrives in Milestone 5.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
