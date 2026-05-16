import { requireOwner } from "@/lib/auth-session";
import {
  buildProductImportPreview,
  PRODUCT_IMPORT_HEADERS,
  type ProductImportInput,
} from "@/lib/product-import";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function cellText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    if ("text" in value) {
      return String(value.text ?? "").trim();
    }

    if ("result" in value) {
      return String(value.result ?? "").trim();
    }

    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
  }

  return String(value).trim();
}

function parseProductsSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.getWorksheet("Products");

  if (!sheet) {
    throw new Error("SHEET_NOT_FOUND");
  }

  const headers = PRODUCT_IMPORT_HEADERS.map((header, index) =>
    cellText(sheet.getRow(1).getCell(index + 1).value),
  );
  const validHeaders = PRODUCT_IMPORT_HEADERS.every(
    (header, index) => headers[index] === header,
  );

  if (!validHeaders) {
    throw new Error("INVALID_HEADERS");
  }

  const rows: ProductImportInput[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const values = PRODUCT_IMPORT_HEADERS.map((header, index) => [
      header,
      cellText(row.getCell(index + 1).value),
    ]);
    const hasValue = values.some(([, value]) => String(value).trim() !== "");

    if (hasValue) {
      rows.push(Object.fromEntries(values));
    }
  });

  return rows;
}

export async function POST(req: Request) {
  const auth = requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "File Excel wajib diupload." },
        { status: 422 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { message: "Format file harus .xlsx." },
        { status: 422 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { message: "File Excel kosong." },
        { status: 422 },
      );
    }

    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);
    const rows = parseProductsSheet(workbook);
    const preview = await buildProductImportPreview(rows);

    return NextResponse.json({ data: preview });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SHEET_NOT_FOUND") {
        return NextResponse.json(
          { message: "Sheet Products tidak ditemukan." },
          { status: 422 },
        );
      }

      if (error.message === "INVALID_HEADERS") {
        return NextResponse.json(
          { message: "Header template tidak sesuai." },
          { status: 422 },
        );
      }

      if (error.message === "EMPTY_FILE") {
        return NextResponse.json(
          { message: "File tidak memiliki baris produk." },
          { status: 422 },
        );
      }

      if (error.message === "TOO_MANY_ROWS") {
        return NextResponse.json(
          { message: "Maksimal import 5.000 row." },
          { status: 422 },
        );
      }
    }

    console.error(error);

    return NextResponse.json(
      { message: "Gagal membaca file Excel." },
      { status: 500 },
    );
  }
}
