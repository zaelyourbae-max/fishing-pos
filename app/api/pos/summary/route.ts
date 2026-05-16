import { requireCashier } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type DetailType =
  | "total-products"
  | "low-stock"
  | "today-transactions"
  | "total-sales";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    gte: start,
    lt: end,
  };
}

function isOwnerRole(role: string | null) {
  return role === "owner" || role === "developer";
}

export async function GET(req: Request) {
  const auth = requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const detail = searchParams.get("detail") as DetailType | null;
  const isOwner = isOwnerRole(auth.session.role);
  const saleWhere = {
    createdAt: todayRange(),
    ...(isOwner ? {} : { cashierId: auth.session.sub }),
  };

  const [totalProducts, activeStockProducts, todaySalesAggregate] =
    await Promise.all([
      prisma.product.count({
        where: {
          isActive: true,
        },
      }),
      prisma.product.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          stock: true,
          minStock: true,
        },
      }),
      prisma.sale.aggregate({
        where: saleWhere,
        _count: {
          _all: true,
        },
        _sum: {
          subtotal: true,
        },
      }),
    ]);
  const lowStockCount = activeStockProducts.filter(
    (product) => product.stock <= product.minStock,
  ).length;

  if (!detail) {
    return NextResponse.json({
      data: {
        role: auth.session.role,
        totalProducts,
        lowStockCount,
        todayTransactions: todaySalesAggregate._count._all,
        totalSales: todaySalesAggregate._sum.subtotal ?? 0,
      },
    });
  }

  if (detail === "total-products" && !isOwner) {
    return NextResponse.json(
      {
        message: "Detail inventory hanya tersedia untuk owner/developer.",
      },
      {
        status: 403,
      },
    );
  }

  if (detail === "total-products") {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        stock: true,
        price: true,
      },
    });

    return NextResponse.json({
      data: {
        title: "Total Produk",
        description: "Daftar produk aktif di inventory.",
        items: products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku ?? "-",
          category: product.category ?? "Tanpa kategori",
          stock: product.stock,
          amount: product.price,
        })),
      },
    });
  }

  if (detail === "low-stock") {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        {
          name: "asc",
        },
      ],
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        minStock: true,
      },
    });
    const lowStockProducts = products
      .filter((product) => product.stock <= product.minStock)
      .sort((left, right) => left.stock - right.stock);

    return NextResponse.json({
      data: {
        title: "Stok Rendah",
        description: isOwner
          ? "Produk aktif yang perlu restock."
          : "Ringkasan produk dengan stok rendah.",
        items: lowStockProducts.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku ?? "-",
          stock: product.stock,
          minStock: product.minStock,
        })),
      },
    });
  }

  if (detail === "today-transactions" || detail === "total-sales") {
    const sales = await prisma.sale.findMany({
      where: saleWhere,
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
      select: {
        id: true,
        invoiceNumber: true,
        createdAt: true,
        subtotal: true,
        paymentMethod: true,
        cashier: {
          select: {
            name: true,
          },
        },
        customer: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: {
        title:
          detail === "today-transactions"
            ? "Transaksi Hari Ini"
            : "Total Penjualan",
        description: isOwner
          ? "Detail penjualan hari ini."
          : "Detail penjualan shift kasir hari ini.",
        total: todaySalesAggregate._sum.subtotal ?? 0,
        count: todaySalesAggregate._count._all,
        items: sales.map((sale) => ({
          id: sale.id,
          invoiceNumber: sale.invoiceNumber,
          createdAt: sale.createdAt,
          customer: sale.customer?.name ?? "Walk-in",
          cashier: sale.cashier.name,
          itemCount: sale._count.items,
          paymentMethod: sale.paymentMethod,
          amount: sale.subtotal,
        })),
      },
    });
  }

  return NextResponse.json(
    {
      message: "Detail tidak dikenal.",
    },
    {
      status: 422,
    },
  );
}
