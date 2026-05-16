<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'sku' => ['nullable', 'string', 'max:80'],
            'category_id' => ['nullable', 'integer', 'exists:product_categories,id'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 15);

        $products = DB::table('products')
            ->leftJoin('product_categories', 'product_categories.id', '=', 'products.product_category_id')
            ->leftJoin('suppliers', 'suppliers.id', '=', 'products.supplier_id')
            ->where('products.is_active', true)
            ->whereNull('products.deleted_at')
            ->when($validated['sku'] ?? null, function ($query, string $sku) {
                $query->where('products.sku', 'ILIKE', '%' . $sku . '%');
            })
            ->when($validated['category_id'] ?? null, function ($query, int $categoryId) {
                $query->where('products.product_category_id', $categoryId);
            })
            ->select([
                'products.id',
                'products.product_category_id',
                'products.supplier_id',
                'products.sku',
                'products.barcode',
                'products.name',
                'products.description',
                'products.unit',
                'products.cost_price',
                'products.selling_price',
                'products.current_stock',
                'products.min_stock',
                'products.is_active',
                'products.created_at',
                'products.updated_at',
                'product_categories.name as category_name',
                'product_categories.slug as category_slug',
                'suppliers.code as supplier_code',
                'suppliers.name as supplier_name',
            ])
            ->orderBy('products.name')
            ->paginate($perPage)
            ->withQueryString();

        return ProductResource::collection($products);
    }
}
