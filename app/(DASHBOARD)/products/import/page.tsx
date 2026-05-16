import ProductImportForm from "@/components/products/import/product-import-form";
import { requireOwnerPage } from "@/lib/page-guards";

export default async function ProductImportPage() {
  await requireOwnerPage();

  return <ProductImportForm />;
}
