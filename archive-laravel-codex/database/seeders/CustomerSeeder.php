<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $customers = [
            [
                'customer_code' => 'CUST-0001',
                'name' => 'Ahmad Pemancing',
                'phone' => '082100000001',
                'email' => 'ahmad@example.test',
                'address' => 'Jl. Danau Biru No. 4, Makassar',
                'loyalty_points' => 120,
            ],
            [
                'customer_code' => 'CUST-0002',
                'name' => 'Siti Angler',
                'phone' => '082100000002',
                'email' => 'siti@example.test',
                'address' => 'Jl. Pelabuhan Lama No. 17, Makassar',
                'loyalty_points' => 80,
            ],
            [
                'customer_code' => 'CUST-0003',
                'name' => 'Komunitas Mancing Timur',
                'phone' => '082100000003',
                'email' => 'komunitas@example.test',
                'address' => 'Jl. Veteran Selatan No. 91, Makassar',
                'loyalty_points' => 250,
            ],
        ];

        foreach ($customers as $customer) {
            DB::table('customers')->updateOrInsert(
                ['customer_code' => $customer['customer_code']],
                [
                    'name' => $customer['name'],
                    'phone' => $customer['phone'],
                    'email' => $customer['email'],
                    'address' => $customer['address'],
                    'loyalty_points' => $customer['loyalty_points'],
                    'is_active' => true,
                    'deleted_at' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }
    }
}
