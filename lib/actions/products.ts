"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  description: z.string().optional(),
  price: z.number(),
  costPrice: z.number(),
  stock: z.number(),
  minStock: z.number(),
  unit: z.string(),
  category: z.string().optional(),
});

export async function createProduct(data: unknown) {
  const validated = productSchema.parse(data);

  await prisma.product.create({
    data: validated,
  });

  revalidatePath("/products");

  return {
    success: true,
  };
}

export async function updateProduct(
  id: number,
  data: unknown
) {
  const validated = productSchema.parse(data);

  await prisma.product.update({
    where: {
      id,
    },
    data: validated,
  });

  revalidatePath("/products");

  return {
    success: true,
  };
}

export async function deleteProduct(id: number) {
  await prisma.product.update({
    where: {
      id,
    },
    data: {
      isActive: false,
    },
  });

  revalidatePath("/products");

  return {
    success: true,
  };
}

export async function adjustStock(
  id: number,
  quantity: number
) {
  const product = await prisma.product.findUnique({
    where: {
      id,
    },
  });

  if (!product) {
    throw new Error("Produk tidak ditemukan");
  }

  await prisma.product.update({
    where: {
      id,
    },
    data: {
      stock: product.stock + quantity,
    },
  });

  revalidatePath("/products");

  return {
    success: true,
  };
}