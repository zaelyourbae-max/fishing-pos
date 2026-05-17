import ReturnForm from "@/components/returns/return-form";
import { requireReturnsPage } from "@/lib/page-guards";

export default async function NewReturnPage() {
  await requireReturnsPage();

  return <ReturnForm />;
}
