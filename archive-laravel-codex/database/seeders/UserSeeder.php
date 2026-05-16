<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $roles = [
            [
                'name' => 'Owner',
                'slug' => 'owner',
                'description' => 'Pemilik toko dengan akses penuh.',
            ],
            [
                'name' => 'Admin',
                'slug' => 'admin',
                'description' => 'Admin operasional toko.',
            ],
            [
                'name' => 'Cashier',
                'slug' => 'cashier',
                'description' => 'Kasir untuk transaksi POS.',
            ],
        ];

        foreach ($roles as $role) {
            DB::table('roles')->updateOrInsert(
                ['slug' => $role['slug']],
                [
                    'name' => $role['name'],
                    'description' => $role['description'],
                    'deleted_at' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }

        $roleIds = DB::table('roles')
            ->whereIn('slug', ['owner', 'admin', 'cashier'])
            ->pluck('id', 'slug');

        $users = [
            [
                'role_id' => $roleIds['owner'],
                'name' => 'Owner Toko',
                'email' => 'owner@fishing-pos.test',
                'phone' => '081200000001',
            ],
            [
                'role_id' => $roleIds['admin'],
                'name' => 'Admin Gudang',
                'email' => 'admin@fishing-pos.test',
                'phone' => '081200000002',
            ],
            [
                'role_id' => $roleIds['cashier'],
                'name' => 'Kasir Utama',
                'email' => 'cashier@fishing-pos.test',
                'phone' => '081200000003',
            ],
        ];

        foreach ($users as $user) {
            DB::table('users')->updateOrInsert(
                ['email' => $user['email']],
                [
                    'role_id' => $user['role_id'],
                    'name' => $user['name'],
                    'password' => Hash::make('password'),
                    'phone' => $user['phone'],
                    'email_verified_at' => $now,
                    'is_active' => true,
                    'remember_token' => Str::random(10),
                    'deleted_at' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }
    }
}
