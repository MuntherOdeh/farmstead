import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { RecentTransaction, TransactionType } from "@/lib/demo/overview";

const TYPE_DOT: Record<TransactionType, string> = {
  sale: "bg-chart-1",
  purchase: "bg-chart-3",
  birth: "bg-chart-2",
  expense: "bg-chart-4",
};

const TYPE_LABEL: Record<TransactionType, string> = {
  sale: "Sale",
  purchase: "Purchase",
  birth: "Birth",
  expense: "Expense",
};

export function RecentTransactions({ data }: { data: RecentTransaction[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Product</TableHead>
          <TableHead className="hidden md:table-cell">Party</TableHead>
          <TableHead className="hidden text-end sm:table-cell">Qty</TableHead>
          <TableHead className="text-end">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((tx, index) => (
          <TableRow key={`${tx.date}-${index}`}>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {tx.date}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="gap-1.5 font-normal">
                <span aria-hidden className={cn("size-1.5 rounded-full", TYPE_DOT[tx.type])} />
                {TYPE_LABEL[tx.type]}
              </Badge>
            </TableCell>
            <TableCell className="max-w-40 truncate">{tx.product}</TableCell>
            <TableCell className="hidden max-w-40 truncate text-muted-foreground md:table-cell">
              {tx.party}
            </TableCell>
            <TableCell className="hidden text-end font-mono text-xs sm:table-cell">
              {tx.qty}
            </TableCell>
            <TableCell className="text-end font-mono text-xs">{tx.total}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
