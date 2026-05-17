import CreateProductForm from "@/components/products/create-product-form";
import { requireManageProductsPage } from "@/lib/page-guards";

export default async function CreateProductPage() {
  await requireManageProductsPage();

  return <CreateProductForm />;
}
