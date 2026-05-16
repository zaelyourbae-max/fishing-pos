import CreateProductForm from "@/components/products/create-product-form";
import { requireOwnerPage } from "@/lib/page-guards";

export default async function CreateProductPage() {
  await requireOwnerPage();

  return <CreateProductForm />;
}
