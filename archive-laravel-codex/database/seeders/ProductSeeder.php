<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $categories = [
            [
                'name' => 'Reel',
                'slug' => 'reel',
                'description' => 'Reel spinning dan baitcasting.',
            ],
            [
                'name' => 'Rod',
                'slug' => 'rod',
                'description' => 'Joran pancing berbagai ukuran.',
            ],
            [
                'name' => 'Lure',
                'slug' => 'lure',
                'description' => 'Umpan tiruan untuk freshwater dan saltwater.',
            ],
            [
                'name' => 'Line',
                'slug' => 'line',
                'description' => 'Senar mono, fluorocarbon, dan braided.',
            ],
            [
                'name' => 'Terminal Tackle',
                'slug' => 'terminal-tackle',
                'description' => 'Kail, swivel, snap, dan perlengkapan kecil.',
            ],
        ];

        foreach ($categories as $category) {
            DB::table('product_categories')->updateOrInsert(
                ['slug' => $category['slug']],
                [
                    'parent_id' => null,
                    'name' => $category['name'],
                    'description' => $category['description'],
                    'is_active' => true,
                    'deleted_at' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }

        $categoryIds = DB::table('product_categories')
            ->whereIn('slug', collect($categories)->pluck('slug')->all())
            ->pluck('id', 'slug');

        $supplierIds = DB::table('suppliers')
            ->whereIn('code', ['SUP-DAIWA', 'SUP-SHIMANO', 'SUP-LOCAL'])
            ->pluck('id', 'code');

        $products = [
            [
                'product_category_id' => $categoryIds['reel'],
                'supplier_id' => $supplierIds['SUP-SHIMANO'] ?? null,
                'sku' => 'REL-SHI-SIENNA-2500',
                'barcode' => '899100000001',
                'name' => 'Shimano Sienna 2500 FG',
                'description' => 'Reel spinning ringan untuk freshwater dan light saltwater.',
                'unit' => 'pcs',
                'cost_price' => 430000,
                'selling_price' => 575000,
                'current_stock' => 12,
                'min_stock' => 3,
            ],
            [
                'product_category_id' => $categoryIds['reel'],
                'supplier_id' => $supplierIds['SUP-DAIWA'] ?? null,
                'sku' => 'REL-DAI-CROSSFIRE-3000',
                'barcode' => '899100000002',
                'name' => 'Daiwa Crossfire LT 3000',
                'description' => 'Reel spinning serbaguna dengan drag halus.',
                'unit' => 'pcs',
                'cost_price' => 510000,
                'selling_price' => 685000,
                'current_stock' => 8,
                'min_stock' => 2,
            ],
            [
                'product_category_id' => $categoryIds['rod'],
                'supplier_id' => $supplierIds['SUP-LOCAL'] ?? null,
                'sku' => 'ROD-UL-180',
                'barcode' => '899100000003',
                'name' => 'Joran Ultra Light 180 cm',
                'description' => 'Joran UL dua section untuk casting ringan.',
                'unit' => 'pcs',
                'cost_price' => 145000,
                'selling_price' => 225000,
                'current_stock' => 15,
                'min_stock' => 4,
            ],
            [
                'product_category_id' => $categoryIds['lure'],
                'supplier_id' => $supplierIds['SUP-LOCAL'] ?? null,
                'sku' => 'LUR-MINNOW-70-HOLO',
                'barcode' => '899100000004',
                'name' => 'Minnow 70 mm Hologram',
                'description' => 'Hard lure minnow untuk predator air tawar.',
                'unit' => 'pcs',
                'cost_price' => 18000,
                'selling_price' => 35000,
                'current_stock' => 50,
                'min_stock' => 10,
            ],
            [
                'product_category_id' => $categoryIds['line'],
                'supplier_id' => $supplierIds['SUP-LOCAL'] ?? null,
                'sku' => 'LIN-BRAID-PE1-150M',
                'barcode' => '899100000005',
                'name' => 'Braided Line PE 1.0 150 m',
                'description' => 'Senar braided PE 1.0 warna hijau.',
                'unit' => 'roll',
                'cost_price' => 62000,
                'selling_price' => 95000,
                'current_stock' => 25,
                'min_stock' => 6,
            ],
            [
                'product_category_id' => $categoryIds['terminal-tackle'],
                'supplier_id' => $supplierIds['SUP-LOCAL'] ?? null,
                'sku' => 'HK-OCTOPUS-06',
                'barcode' => '899100000006',
                'name' => 'Kail Octopus Size 6',
                'description' => 'Kail octopus tajam, isi 20 pcs per pack.',
                'unit' => 'pack',
                'cost_price' => 9000,
                'selling_price' => 18000,
                'current_stock' => 60,
                'min_stock' => 12,
            ],
        ];

        foreach ($products as $product) {
            DB::table('products')->updateOrInsert(
                ['sku' => $product['sku']],
                [
                    'product_category_id' => $product['product_category_id'],
                    'supplier_id' => $product['supplier_id'],
                    'barcode' => $product['barcode'],
                    'name' => $product['name'],
                    'description' => $product['description'],
                    'unit' => $product['unit'],
                    'cost_price' => $product['cost_price'],
                    'selling_price' => $product['selling_price'],
                    'current_stock' => $product['current_stock'],
                    'min_stock' => $product['min_stock'],
                    'is_active' => true,
                    'deleted_at' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }
    }
}
