<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SaleTransactionTest extends TestCase
{
    use RefreshDatabase;

    public function test_stok_habis_ditolak(): void
    {
        $this->actingAsCashier();
        $productId = $this->createProduct([
            'current_stock' => 0,
        ]);

        $response = $this->postJson('/api/sales', $this->payload([
            'items' => [
                [
                    'product_id' => $productId,
                    'quantity' => 1,
                    'unit_price' => 75000,
                ],
            ],
        ]));

        $response->assertUnprocessable();
        $this->assertDatabaseCount('sales', 0);
        $this->assertDatabaseCount('sale_items', 0);
        $this->assertDatabaseCount('stock_movements', 0);
        $this->assertSame('0.000', $this->productStock($productId));
    }

    public function test_qty_negatif_ditolak_oleh_validasi(): void
    {
        $this->actingAsCashier();
        $productId = $this->createProduct([
            'current_stock' => 10,
        ]);

        $response = $this->postJson('/api/sales', $this->payload([
            'items' => [
                [
                    'product_id' => $productId,
                    'quantity' => -1,
                    'unit_price' => 75000,
                ],
            ],
        ]));

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['items.0.quantity']);

        $this->assertDatabaseCount('sales', 0);
        $this->assertSame('10.000', $this->productStock($productId));
    }

    public function test_produk_tidak_aktif_ditolak(): void
    {
        $this->actingAsCashier();
        $productId = $this->createProduct([
            'is_active' => false,
            'current_stock' => 10,
        ]);

        $response = $this->postJson('/api/sales', $this->payload([
            'items' => [
                [
                    'product_id' => $productId,
                    'quantity' => 1,
                    'unit_price' => 75000,
                ],
            ],
        ]));

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['items.0.product_id']);

        $this->assertDatabaseCount('sales', 0);
        $this->assertSame('10.000', $this->productStock($productId));
    }

    public function test_pembayaran_kurang_diterima_sebagai_partial_payment(): void
    {
        $this->actingAsCashier();
        $productId = $this->createProduct([
            'current_stock' => 10,
            'selling_price' => 75000,
        ]);

        $response = $this->postJson('/api/sales', $this->payload([
            'paid_amount' => 50000,
            'items' => [
                [
                    'product_id' => $productId,
                    'quantity' => 1,
                    'unit_price' => 75000,
                ],
            ],
        ]));

        $response
            ->assertCreated()
            ->assertJsonPath('data.payment_status', 'partial')
            ->assertJsonPath('data.grand_total', '75000.00')
            ->assertJsonPath('data.paid_amount', '50000.00')
            ->assertJsonPath('data.change_amount', '0.00');

        $this->assertDatabaseHas('sales', [
            'payment_status' => 'partial',
            'grand_total' => 75000,
            'paid_amount' => 50000,
        ]);
        $this->assertSame('9.000', $this->productStock($productId));
    }

    public function test_transaksi_rollback_jika_gagal_saat_mencatat_stock_movement(): void
    {
        $this->actingAsCashier();
        $productId = $this->createProduct([
            'current_stock' => 10,
            'selling_price' => 75000,
        ]);

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->string('rollback_test_required');
        });

        $response = $this->postJson('/api/sales', $this->payload([
            'items' => [
                [
                    'product_id' => $productId,
                    'quantity' => 2,
                    'unit_price' => 75000,
                ],
            ],
        ]));

        $response->assertStatus(500);
        $this->assertDatabaseCount('sales', 0);
        $this->assertDatabaseCount('sale_items', 0);
        $this->assertDatabaseCount('stock_movements', 0);
        $this->assertSame('10.000', $this->productStock($productId));
    }

    private function actingAsCashier(): User
    {
        $now = now();

        $roleId = DB::table('roles')->insertGetId([
            'name' => 'Cashier',
            'slug' => 'cashier',
            'description' => 'Kasir untuk transaksi POS.',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $userId = DB::table('users')->insertGetId([
            'role_id' => $roleId,
            'name' => 'Kasir Test',
            'email' => 'cashier-test@example.test',
            'email_verified_at' => $now,
            'password' => Hash::make('password'),
            'phone' => '081200000999',
            'is_active' => true,
            'remember_token' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $user = User::query()->findOrFail($userId);

        Sanctum::actingAs($user);

        return $user;
    }

    private function createProduct(array $overrides = []): int
    {
        $now = now();

        return DB::table('products')->insertGetId(array_merge([
            'product_category_id' => null,
            'supplier_id' => null,
            'sku' => 'SKU-TEST-' . fake()->unique()->numberBetween(1000, 9999),
            'barcode' => null,
            'name' => 'Reel Test',
            'description' => 'Produk dummy untuk test transaksi.',
            'unit' => 'pcs',
            'cost_price' => 50000,
            'selling_price' => 75000,
            'current_stock' => 10,
            'min_stock' => 2,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ], $overrides));
    }

    private function payload(array $overrides = []): array
    {
        return array_replace_recursive([
            'customer_id' => null,
            'payment_method' => 'cash',
            'paid_amount' => 100000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'notes' => 'Transaksi dari automated test.',
            'items' => [
                [
                    'product_id' => null,
                    'quantity' => 1,
                    'unit_price' => 75000,
                    'discount_amount' => 0,
                    'tax_amount' => 0,
                ],
            ],
        ], $overrides);
    }

    private function productStock(int $productId): string
    {
        return DB::table('products')
            ->where('id', $productId)
            ->value('current_stock');
    }
}
