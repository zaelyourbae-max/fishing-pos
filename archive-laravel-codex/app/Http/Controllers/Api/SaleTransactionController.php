<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSaleRequest;
use App\Http\Resources\SaleResource;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SaleTransactionController extends Controller
{
    public function store(StoreSaleRequest $request): JsonResponse
    {
        $cashier = $request->user();

        if (! $cashier) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validated();

        $saleId = DB::transaction(function () use ($cashier, $validated) {
            $now = now();
            $saleDate = isset($validated['sale_date'])
                ? CarbonImmutable::parse($validated['sale_date'])
                : $now;

            $items = collect($validated['items']);
            $productIds = $items->pluck('product_id')->unique()->values()->all();

            $products = DB::table('products')
                ->whereIn('id', $productIds)
                ->whereNull('deleted_at')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $this->assertProductsAreSellable($products, $items);

            $requiredStock = [];
            foreach ($items as $item) {
                $productId = (int) $item['product_id'];
                $requiredStock[$productId] = ($requiredStock[$productId] ?? 0) + (float) $item['quantity'];
            }

            foreach ($requiredStock as $productId => $quantity) {
                $product = $products[$productId];
                if ((float) $product->current_stock < $quantity) {
                    throw ValidationException::withMessages([
                        'items' => [
                            "Stok {$product->name} tidak cukup. Tersedia {$product->current_stock}, diminta {$quantity}.",
                        ],
                    ]);
                }
            }

            [$preparedItems, $totals] = $this->prepareSaleItems($items, $products);

            $headerDiscount = (float) ($validated['discount_amount'] ?? 0);
            $headerTax = (float) ($validated['tax_amount'] ?? 0);
            $discountAmount = round($totals['item_discount'] + $headerDiscount, 2);
            $taxAmount = round($totals['item_tax'] + $headerTax, 2);
            $grandTotal = round($totals['subtotal'] - $discountAmount + $taxAmount, 2);

            if ($grandTotal < 0) {
                throw ValidationException::withMessages([
                    'discount_amount' => ['Total diskon tidak boleh lebih besar dari subtotal + pajak.'],
                ]);
            }

            $paidAmount = round((float) $validated['paid_amount'], 2);
            $changeAmount = max(round($paidAmount - $grandTotal, 2), 0);

            $saleNumber = $this->generateSaleNumber();

            $saleId = DB::table('sales')->insertGetId([
                'sale_number' => $saleNumber,
                'customer_id' => $validated['customer_id'] ?? null,
                'cashier_id' => $cashier->id,
                'sale_date' => $saleDate,
                'status' => 'completed',
                'payment_status' => $this->resolvePaymentStatus($paidAmount, $grandTotal),
                'payment_method' => $validated['payment_method'] ?? null,
                'subtotal' => $totals['subtotal'],
                'discount_amount' => $discountAmount,
                'tax_amount' => $taxAmount,
                'grand_total' => $grandTotal,
                'paid_amount' => $paidAmount,
                'change_amount' => $changeAmount,
                'notes' => $validated['notes'] ?? null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $currentStock = $products->mapWithKeys(fn ($product) => [
                $product->id => (float) $product->current_stock,
            ])->all();

            foreach ($preparedItems as $item) {
                $saleItemId = DB::table('sale_items')->insertGetId([
                    'sale_id' => $saleId,
                    'product_id' => $item['product_id'],
                    'product_sku' => $item['product_sku'],
                    'product_name' => $item['product_name'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'discount_amount' => $item['discount_amount'],
                    'tax_amount' => $item['tax_amount'],
                    'line_total' => $item['line_total'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $before = $currentStock[$item['product_id']];
                $after = round($before - $item['quantity'], 3);
                $currentStock[$item['product_id']] = $after;

                DB::table('products')
                    ->where('id', $item['product_id'])
                    ->update([
                        'current_stock' => $after,
                        'updated_at' => $now,
                    ]);

                DB::table('stock_movements')->insert([
                    'product_id' => $item['product_id'],
                    'sale_id' => $saleId,
                    'sale_item_id' => $saleItemId,
                    'purchase_id' => null,
                    'purchase_item_id' => null,
                    'created_by' => $cashier->id,
                    'movement_type' => 'sale',
                    'quantity_delta' => -1 * $item['quantity'],
                    'quantity_before' => $before,
                    'quantity_after' => $after,
                    'unit_cost' => $item['cost_price'],
                    'reference_number' => $saleNumber,
                    'notes' => 'Penjualan POS',
                    'movement_date' => $saleDate,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            return $saleId;
        }, 3);

        return (new SaleResource($this->loadSale($saleId)))
            ->response()
            ->setStatusCode(201);
    }

    public function show(int $sale): JsonResponse
    {
        $data = $this->loadSale($sale);

        if (! $data) {
            return response()->json(['message' => 'Sale not found.'], 404);
        }

        return (new SaleResource($data))->response();
    }

    private function assertProductsAreSellable($products, $items): void
    {
        foreach ($items as $index => $item) {
            $product = $products->get((int) $item['product_id']);

            if (! $product || ! $product->is_active) {
                throw ValidationException::withMessages([
                    "items.{$index}.product_id" => ['Produk tidak aktif atau tidak ditemukan.'],
                ]);
            }
        }
    }

    private function prepareSaleItems($items, $products): array
    {
        $preparedItems = [];
        $subtotal = 0;
        $itemDiscount = 0;
        $itemTax = 0;

        foreach ($items as $index => $item) {
            $product = $products[(int) $item['product_id']];
            $quantity = round((float) $item['quantity'], 3);
            $unitPrice = round((float) ($item['unit_price'] ?? $product->selling_price), 2);
            $discountAmount = round((float) ($item['discount_amount'] ?? 0), 2);
            $taxAmount = round((float) ($item['tax_amount'] ?? 0), 2);
            $grossAmount = round($quantity * $unitPrice, 2);
            $lineTotal = round($grossAmount - $discountAmount + $taxAmount, 2);

            if ($lineTotal < 0) {
                throw ValidationException::withMessages([
                    "items.{$index}.discount_amount" => ['Diskon item tidak boleh membuat line_total negatif.'],
                ]);
            }

            $preparedItems[] = [
                'product_id' => (int) $product->id,
                'product_sku' => $product->sku,
                'product_name' => $product->name,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'cost_price' => round((float) $product->cost_price, 2),
                'discount_amount' => $discountAmount,
                'tax_amount' => $taxAmount,
                'line_total' => $lineTotal,
            ];

            $subtotal = round($subtotal + $grossAmount, 2);
            $itemDiscount = round($itemDiscount + $discountAmount, 2);
            $itemTax = round($itemTax + $taxAmount, 2);
        }

        return [
            $preparedItems,
            [
                'subtotal' => $subtotal,
                'item_discount' => $itemDiscount,
                'item_tax' => $itemTax,
            ],
        ];
    }

    private function resolvePaymentStatus(float $paidAmount, float $grandTotal): string
    {
        if ($paidAmount <= 0) {
            return 'unpaid';
        }

        if ($paidAmount < $grandTotal) {
            return 'partial';
        }

        return 'paid';
    }

    private function generateSaleNumber(): string
    {
        return 'SL-' . now()->format('YmdHis') . '-' . random_int(1000, 9999);
    }

    private function loadSale(int $saleId): ?array
    {
        $sale = DB::table('sales')
            ->where('id', $saleId)
            ->first();

        if (! $sale) {
            return null;
        }

        $customer = $sale->customer_id
            ? DB::table('customers')->where('id', $sale->customer_id)->first(['id', 'customer_code', 'name', 'phone'])
            : null;

        $cashier = DB::table('users')->where('id', $sale->cashier_id)->first(['id', 'name', 'email']);

        $items = DB::table('sale_items')
            ->where('sale_id', $saleId)
            ->orderBy('id')
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_sku' => $item->product_sku,
                'product_name' => $item->product_name,
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
                'discount_amount' => $item->discount_amount,
                'tax_amount' => $item->tax_amount,
                'line_total' => $item->line_total,
            ])
            ->all();

        $stockMovements = DB::table('stock_movements')
            ->where('sale_id', $saleId)
            ->orderBy('id')
            ->get()
            ->map(fn ($movement) => [
                'id' => $movement->id,
                'product_id' => $movement->product_id,
                'sale_item_id' => $movement->sale_item_id,
                'movement_type' => $movement->movement_type,
                'quantity_delta' => $movement->quantity_delta,
                'quantity_before' => $movement->quantity_before,
                'quantity_after' => $movement->quantity_after,
                'movement_date' => $movement->movement_date,
            ])
            ->all();

        return [
            'id' => $sale->id,
            'sale_number' => $sale->sale_number,
            'sale_date' => $sale->sale_date,
            'status' => $sale->status,
            'payment_status' => $sale->payment_status,
            'payment_method' => $sale->payment_method,
            'subtotal' => $sale->subtotal,
            'discount_amount' => $sale->discount_amount,
            'tax_amount' => $sale->tax_amount,
            'grand_total' => $sale->grand_total,
            'paid_amount' => $sale->paid_amount,
            'change_amount' => $sale->change_amount,
            'notes' => $sale->notes,
            'customer' => $customer ? [
                'id' => $customer->id,
                'customer_code' => $customer->customer_code,
                'name' => $customer->name,
                'phone' => $customer->phone,
            ] : null,
            'cashier' => $cashier ? [
                'id' => $cashier->id,
                'name' => $cashier->name,
                'email' => $cashier->email,
            ] : null,
            'items' => $items,
            'stock_movements' => $stockMovements,
            'created_at' => $sale->created_at,
            'updated_at' => $sale->updated_at,
        ];
    }
}
