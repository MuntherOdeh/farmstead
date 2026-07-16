"use client";

import Decimal from "decimal.js";
import { format, parseISO } from "date-fns";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format";

export interface PartySummary {
  id: string;
  name: string;
  type: string;
  txCount: number;
  revenue: string;
  spend: string;
  lastActivity: string | null;
  recent: {
    id: string;
    occurredOn: string;
    type: string;
    productName: string;
    qty: string;
    total: string | null;
  }[];
}

export function PartiesView({ parties }: { parties: PartySummary[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<PartySummary | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return parties.filter((party) => {
      if (typeFilter !== "all" && party.type !== typeFilter) return false;
      if (query && !party.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [parties, search, typeFilter]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search parties…"
            className="w-56 ps-8"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All parties</SelectItem>
            <SelectItem value="customer">Customers</SelectItem>
            <SelectItem value="supplier">Suppliers</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-end">Transactions</TableHead>
              <TableHead className="text-end">Revenue from</TableHead>
              <TableHead className="text-end">Spent with</TableHead>
              <TableHead className="hidden md:table-cell">Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((party) => (
              <TableRow
                key={party.id}
                className="cursor-pointer"
                onClick={() => setSelected(party)}
              >
                <TableCell className="font-medium">{party.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {party.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-end font-mono text-xs">{party.txCount}</TableCell>
                <TableCell className="text-end font-mono text-xs">
                  {formatMoney(Number(new Decimal(party.revenue).toFixed(0)))}
                </TableCell>
                <TableCell className="text-end font-mono text-xs">
                  {formatMoney(Number(new Decimal(party.spend).toFixed(0)))}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {party.lastActivity
                    ? format(parseISO(party.lastActivity), "d MMM yy")
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selected?.name}</SheetTitle>
            <SheetDescription>
              {selected?.txCount} transactions ·{" "}
              {selected ? formatMoney(Number(new Decimal(selected.revenue).toFixed(0))) : ""} revenue
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-auto px-4 pb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-end">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selected?.recent.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {format(parseISO(tx.occurredOn), "d MMM yy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-36 truncate">{tx.productName}</TableCell>
                    <TableCell className="text-end font-mono text-xs">
                      {tx.total
                        ? formatMoney(Number(new Decimal(tx.total).toFixed(2)))
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
