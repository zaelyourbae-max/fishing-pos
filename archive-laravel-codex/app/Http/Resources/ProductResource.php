<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'sku' => $this->sku,
            'barcode' => $this->barcode,
            'name' => $this->name,
            'description' => $this->description,
            'unit' => $this->unit,
            'cost_price' => $this->cost_price,
            'selling_price' => $this->selling_price,
            'current_stock' => $this->current_stock,
            'min_stock' => $this->min_stock,
            'is_active' => (bool) $this->is_active,
            'category' => $this->product_category_id ? [
                'id' => $this->product_category_id,
                'name' => $this->category_name,
                'slug' => $this->category_slug,
            ] : null,
            'supplier' => $this->supplier_id ? [
                'id' => $this->supplier_id,
                'code' => $this->supplier_code,
                'name' => $this->supplier_name,
            ] : null,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
