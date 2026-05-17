import ProductImportForm from "@/components/products/import/product-import-form";
import { requireManageProductsPage } from "@/lib/page-guards";

export default async function ProductImportPage() {
  await requireManageProductsPage();

  return <ProductImportForm />;
}
