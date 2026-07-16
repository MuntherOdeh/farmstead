import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import {
  listAttributeDefs,
  listCategories,
  listProducts,
  listUnits,
} from "@/lib/products/queries";
import { ProductsView } from "@/components/products/products-view";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const user = await requireUser();
  const [products, categories, units, attributeDefs] = await Promise.all([
    listProducts(),
    listCategories(),
    listUnits(),
    listAttributeDefs(),
  ]);

  return (
    <ProductsView
      initialProducts={products}
      initialCategories={categories}
      initialUnits={units}
      initialAttributeDefs={attributeDefs}
      canEdit={user.role === "admin"}
    />
  );
}
