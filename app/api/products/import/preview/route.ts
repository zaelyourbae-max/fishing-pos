import { requireOwner } from "@/lib/auth-session";
import {
  buildProductImportPreview,
  PRODUCT_IMPORT_MAX_FILE_SIZE_BYTES,
  PRODUCT_IMPORT_HEADERS,
  PRODUCT_IMPORT_TEMPLATE_HEADERS,
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

function hasFormula(value: ExcelJS.CellValue) {
  return (
    typeof value === "object" &&
    value !== null &&
    "formula" in value &&
    Boolean(value.formula)
  );
}

function excelColumnName(index: number) {
  let value = index;
  let name = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }

  return name;
}

function parseProductsSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.getWorksheet("Products");

  if (!sheet) {
    throw new Error("SHEET_NOT_FOUND");
  }

  // Petakan kolom berdasarkan NAMA judul di baris 1, bukan urutan. Dengan
  // begitu template baru (tanpa type/size/rackLocation) maupun template lama
  // (lengkap 16 kolom) sama-sama terbaca, dan kolom yang tidak ada cukup
  // dianggap kosong.
  const columnIndexByHeader = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const text = cellText(cell.value);
    if (
      (PRODUCT_IMPORT_HEADERS as readonly string[]).includes(text) &&
      !columnIndexByHeader.has(text)
    ) {
      columnIndexByHeader.set(text, colNumber);
    }
  });

  // Header dianggap valid jika semua kolom template tersedia.
  const hasTemplateHeaders = PRODUCT_IMPORT_TEMPLATE_HEADERS.every((header) =>
    columnIndexByHeader.has(header),
  );

  if (!hasTemplateHeaders) {
    throw new Error("INVALID_HEADERS");
  }

  const rows: ProductImportInput[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const values = PRODUCT_IMPORT_HEADERS.map((header) => {
      const colNumber = columnIndexByHeader.get(header);

      if (colNumber === undefined) {
        return [header, ""];
      }

      const cellValue = row.getCell(colNumber).value;

      if (hasFormula(cellValue)) {
        throw new Error(
          `FORMULA_NOT_ALLOWED:${rowNumber}:${excelColumnName(colNumber)}`,
        );
      }

      return [header, cellText(cellValue)];
    });
    const hasValue = values.some(([, value]) => String(value).trim() !== "");

    if (hasValue) {
      rows.push(Object.fromEntries(values));
    }
  });

  return rows;
}

export async function POST(req: Request) {
  const auth = await requireOwner(req);

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

    if (file.size > PRODUCT_IMPORT_MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          message:
            "Ukuran file terlalu besar. Maksimal 10 MB untuk import produk.",
        },
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

      if (error.message.startsWith("FORMULA_NOT_ALLOWED")) {
        const [, row, column] = error.message.split(":");

        return NextResponse.json(
          {
            message:
              row && column
                ? `Template import tidak boleh memakai formula Excel. Ditemukan di sel ${column}${row}.`
                : "Template import tidak boleh memakai formula Excel.",
          },
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
