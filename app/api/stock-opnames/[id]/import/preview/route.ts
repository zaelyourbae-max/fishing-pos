import { requireCashier } from "@/lib/auth-session";
import {
  STOCK_OPNAME_IMPORT_HEADERS,
  STOCK_OPNAME_MAX_FILE_SIZE_BYTES,
  stockOpnameErrorPayload,
  type StockOpnameImportInput,
  validateStockOpnameImportRows,
} from "@/lib/stock-opname";
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

function parseStockOpnameSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.getWorksheet("StockOpname");

  if (!sheet) {
    throw new Error("SHEET_NOT_FOUND");
  }

  const headers = STOCK_OPNAME_IMPORT_HEADERS.map((header, index) =>
    cellText(sheet.getRow(1).getCell(index + 1).value),
  );
  const validHeaders = STOCK_OPNAME_IMPORT_HEADERS.every(
    (header, index) => headers[index] === header,
  );

  if (!validHeaders) {
    throw new Error("INVALID_HEADERS");
  }

  const rows: StockOpnameImportInput[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const values = STOCK_OPNAME_IMPORT_HEADERS.map((header, index) => {
      const cellValue = row.getCell(index + 1).value;

      if (hasFormula(cellValue)) {
        throw new Error(
          `FORMULA_NOT_ALLOWED:${rowNumber}:${excelColumnName(index + 1)}`,
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

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const auth = await requireCashier(request);

  if (!auth.ok) {
    return auth.response;
  }

  const params = await context.params;

  try {
    const formData = await request.formData();
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

    if (file.size > STOCK_OPNAME_MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { message: "Ukuran file terlalu besar. Maksimal 10 MB." },
        { status: 422 },
      );
    }

    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);
    const rows = parseStockOpnameSheet(workbook);
    const preview = await validateStockOpnameImportRows({
      sessionId: params.id,
      rows,
    });

    return NextResponse.json({ data: preview });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SHEET_NOT_FOUND") {
        return NextResponse.json(
          { message: "Sheet StockOpname tidak ditemukan." },
          { status: 422 },
        );
      }

      if (error.message === "INVALID_HEADERS") {
        return NextResponse.json(
          { message: "Header template tidak sesuai." },
          { status: 422 },
        );
      }

      if (error.message.startsWith("FORMULA_NOT_ALLOWED")) {
        const [, row, column] = error.message.split(":");

        return NextResponse.json(
          {
            message:
              row && column
                ? `Template Stock Opname tidak boleh memakai formula Excel. Ditemukan di sel ${column}${row}.`
                : "Template Stock Opname tidak boleh memakai formula Excel.",
          },
          { status: 422 },
        );
      }
    }

    const payload = stockOpnameErrorPayload(error);

    return NextResponse.json(payload, { status: payload.status });
  }
}
