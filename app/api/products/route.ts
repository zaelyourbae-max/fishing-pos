import {
  canViewCostPrice,
  requireCashier,
  requireOwner,
} from "@/lib/auth-session";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function readImageUrl(value: unknown) {
  const imageUrl = String(value ?? "").trim();

  return imageUrl.startsWith("/uploads/products/") ? imageUrl : null;
}

export async function GET(req: Request) {
  const auth = requireCashier(req);

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
      description: product.description,
      image_url: product.imageUrl,
      imageUrl: product.imageUrl,
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
      supplier: null,
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
  const auth = requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await req.json();

    if (!body.name || body.price === undefined || body.stock === undefined) {
      return NextResponse.json(
        {
          error: "Semua field wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    const product = await prisma.product.create({
      data: {
        sku: body.sku ? String(body.sku).trim().toUpperCase() : undefined,
        barcode: body.barcode ? String(body.barcode).trim().toUpperCase() : undefined,
        name: String(body.name).trim(),
        description: body.description ? String(body.description).trim() : null,
        price: Number(body.price),
        costPrice: Number(body.costPrice ?? 0),
        stock: Number(body.stock),
        minStock: Number(body.minStock ?? 5),
        unit: body.unit ? String(body.unit).trim() : "pcs",
        category: body.category ? String(body.category).trim() : null,
        imageUrl: readImageUrl(body.imageUrl),
        isActive: true,
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.log(error);

    return NextResponse.json(
      {
        error: "Server error",
      },
      {
        status: 500,
      }
    );
  }
}
