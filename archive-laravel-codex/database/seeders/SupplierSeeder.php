<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SupplierSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $suppliers = [
            [
                'code' => 'SUP-DAIWA',
                'name' => 'Daiwa Nusantara Supply',
                'contact_person' => 'Budi Santoso',
                'phone' => '081300000101',
                'email' => 'sales@daiwa-supply.test',
                'address' => 'Jl. Pancing Raya No. 10, Jakarta',
            ],
            [
                'code' => 'SUP-SHIMANO',
                'name' => 'Shimano Fishing Indonesia',
                'contact_person' => 'Rina Wijaya',
                'phone' => '081300000102',
                'email' => 'order@shimano-fishing.test',
                'address' => 'Jl. Laut Selatan No. 22, Surabaya',
            ],
            [
                'code' => 'SUP-LOCAL',
                'name' => 'Grosir Alat Pancing Makassar',
                'contact_person' => 'Andi Yusuf',
                'phone' => '081300000103',
                'email' => 'grosir@pancingmakassar.test',
                'address' => 'Jl. Perintis Kemerdekaan No. 55, Makassar',
            ],
        ];

        foreach ($suppliers as $supplier) {
            DB::table('suppliers')->updateOrInsert(
                ['code' => $supplier['code']],
                [
                    'name' => $supplier['name'],
                    'contact_person' => $supplier['contact_person'],
                    'phone' => $supplier['phone'],
                    'email' => $supplier['email'],
                    'address' => $supplier['address'],
                    'is_active' => true,
                    'deleted_at' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }
    }
}
