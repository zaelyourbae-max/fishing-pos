<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SaleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $sale = $this->resource;

        return [
            'id' => $sale['id'],
            'sale_number' => $sale['sale_number'],
            'sale_date' => $sale['sale_date'],
            'status' => $sale['status'],
            'payment_status' => $sale['payment_status'],
            'payment_method' => $sale['payment_method'],
            'subtotal' => $sale['subtotal'],
            'discount_amount' => $sale['discount_amount'],
            'tax_amount' => $sale['tax_amount'],
            'grand_total' => $sale['grand_total'],
            'paid_amount' => $sale['paid_amount'],
            'change_amount' => $sale['change_amount'],
            'notes' => $sale['notes'],
            'customer' => $sale['customer'],
            'cashier' => $sale['cashier'],
            'items' => $sale['items'],
            'stock_movements' => $sale['stock_movements'] ?? [],
            'created_at' => $sale['created_at'],
            'updated_at' => $sale['updated_at'],
        ];
    }
}
