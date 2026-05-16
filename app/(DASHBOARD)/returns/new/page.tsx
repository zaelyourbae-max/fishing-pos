import ReturnForm from "@/components/returns/return-form";
import { requireProtectedPage } from "@/lib/page-guards";

export default async function NewReturnPage() {
  await requireProtectedPage();

  return <ReturnForm />;
}
