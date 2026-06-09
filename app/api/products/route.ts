import {
  canViewCostPrice,
  requireCashier,
  requireOwner,
} from "@/lib/auth-session";
import { guardStoreOpen } from "@/lib/store-status";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

function readImageUrl(value: unknown) {
  const imageUrl = String(value ?? "").trim();

  return imageUrl.startsWith("/uploads/products/") ? imageUrl : null;
}

function readOptionalText(value: unknown) {
  const text = String(value ?? "").trim();

  return text ? text : null;
}

function readRequiredText(value: unknown) {
  const text = String(value ?? "").trim();

  return text ? text : null;
}

function parseNonNegativeInteger(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number) || !Number.isInteger(number) || number < 0) {
    return null;
  }

  return number;
}

function supplierCode() {
  return `SUP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
}

async function resolveSupplierId(name: string | null) {
  if (!name) {
    return null;
  }

  const existing = await prisma.supplier.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.supplier.create({
    data: {
      code: supplierCode(),
      name,
      type: "SUPPLIER",
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  return created.id;
}

export async function GET(req: Request) {
  const auth = await requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const sku = searchParams.get("sku")?.trim();
  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim();
  const includeInactive = searchParams.get("includeInactive") === "true";
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
  const perPage = Math.min(
    Math.max(Number(searchParams.get("per_page") ?? 15), 1),
    100,
  );

  if (
    includeInactive &&
    auth.session.role !== "owner" &&
    auth.session.role !== "developer"
  ) {
    return NextResponse.json(
      {
        message: "Forbidden.",
      },
      {
        status: 403,
      },
    );
  }

  const where = {
    ...(includeInactive ? {} : { isActive: true }),
    ...(sku
      ? {
          sku: {
            contains: sku,
            mode: "insensitive" as const,
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            {
              name: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
            {
              sku: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
            {
              barcode: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
            {
              category: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
    ...(category
      ? {
          category: {
            equals: category,
            mode: "insensitive" as const,
          },
        }
      : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: {
        name: "asc",
      },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const canViewCost = canViewCostPrice(auth.session.role);

  return NextResponse.json({
    data: products.map((product) => ({
      id: product.id,
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      brand: product.brand,
      type: product.type,
      size: product.size,
      variant: product.variant,
      description: product.description,
      image_url: product.imageUrl,
      imageUrl: product.imageUrl,
      rack_location: product.rackLocation,
      rackLocation: product.rackLocation,
      unit: product.unit,
      ...(canViewCost ? { cost_price: product.costPrice } : {}),
      selling_price: product.price,
      current_stock: product.stock,
      min_stock: product.minStock,
      is_active: product.isActive,
      category: product.category
        ? {
            id: product.category,
            name: product.category,
          }
        : null,
      supplier: product.supplier
        ? {
            id: product.supplier.id,
            name: product.supplier.name,
          }
        : null,
      created_at: product.createdAt,
      updated_at: product.updatedAt,
    })),
    meta: {
      current_page: page,
      per_page: perPage,
      total,
      last_page: Math.max(Math.ceil(total / perPage), 1),
    },
  });
}

export async function POST(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const storeClosed = await guardStoreOpen();

  if (storeClosed) {
    return storeClosed;
  }

  try {
    const body = await req.json();
    const name = readRequiredText(body.name);
    const category = readRequiredText(body.category);
    const unit = readRequiredText(body.unit);
    const price = parseNonNegativeInteger(body.price);
    const costPrice = parseNonNegativeInteger(body.costPrice ?? 0);
    const stock = parseNonNegativeInteger(body.stock);
    const minStock = parseNonNegativeInteger(body.minStock ?? 0);
    const supplierName = readOptionalText(body.supplier);

    if (
      !name ||
      !category ||
      !unit ||
      price === null ||
      costPrice === null ||
      stock === null ||
      minStock === null
    ) {
      return NextResponse.json(
        {
          message:
            "Field wajib: nama, kategori, unit, harga jual, HPP, stok, dan min stok harus valid.",
        },
        {
          status: 422,
        }
      );
    }

    const supplierId = await resolveSupplierId(supplierName);
    const product = await prisma.product.create({
      data: {
        sku: readOptionalText(body.sku)?.toUpperCase() ?? undefined,
        barcode: readOptionalText(body.barcode)?.toUpperCase() ?? undefined,
        name,
        category,
        brand: readOptionalText(body.brand),
        variant: readOptionalText(body.variant),
        description: readOptionalText(body.description),
        price,
        costPrice,
        stock,
        minStock,
        unit,
        supplierId,
        imageUrl: readImageUrl(body.imageUrl),
        isActive: true,
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(",")
        : String(error.meta?.target ?? "");

      if (target.includes("sku")) {
        return NextResponse.json(
          { message: "SKU sudah dipakai produk lain." },
          { status: 422 },
        );
      }

      if (target.includes("barcode")) {
        return NextResponse.json(
          { message: "Barcode sudah dipakai produk lain." },
          { status: 422 },
        );
      }
    }

    console.log(error);

    return NextResponse.json(
      {
        message: "Server error",
      },
      {
        status: 500,
      }
    );
  }
}
