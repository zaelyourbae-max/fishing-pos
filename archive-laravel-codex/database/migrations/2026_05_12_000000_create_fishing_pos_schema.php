<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('slug', 100)->unique();
            $table->text('description')->nullable();
            $table->timestampsTz();
            $table->softDeletesTz();
        });

        Schema::create('product_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('product_categories')->nullOnDelete();
            $table->string('name', 150);
            $table->string('slug', 170)->unique();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['parent_id', 'is_active']);
        });

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('role_id')->constrained('roles')->restrictOnDelete();
            $table->string('name', 150);
            $table->string('email', 190)->unique();
            $table->timestampTz('email_verified_at')->nullable();
            $table->string('password');
            $table->string('phone', 30)->nullable();
            $table->boolean('is_active')->default(true);
            $table->rememberToken();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index(['role_id', 'is_active']);
        });

        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique();
            $table->string('name', 180);
            $table->string('contact_person', 150)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email', 190)->nullable();
            $table->text('address')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index('name');
            $table->index('phone');
            $table->index(['is_active', 'deleted_at']);
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('customer_code', 50)->unique();
            $table->string('name', 180);
            $table->string('phone', 30)->nullable();
            $table->string('email', 190)->nullable();
            $table->text('address')->nullable();
            $table->integer('loyalty_points')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index('name');
            $table->index('phone');
            $table->index(['is_active', 'deleted_at']);
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_category_id')->nullable()->constrained('product_categories')->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->string('sku', 80)->unique();
            $table->string('barcode', 100)->nullable()->unique();
            $table->string('name', 180);
            $table->text('description')->nullable();
            $table->string('unit', 30)->default('pcs');
            $table->decimal('cost_price', 15, 2)->default(0);
            $table->decimal('selling_price', 15, 2);
            $table->decimal('current_stock', 12, 3)->default(0);
            $table->decimal('min_stock', 12, 3)->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index('name');
            $table->index(['product_category_id', 'is_active']);
            $table->index(['supplier_id', 'is_active']);
            $table->index(['is_active', 'deleted_at']);
        });

        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->string('sale_number', 50)->unique();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('cashier_id')->constrained('users')->restrictOnDelete();
            $table->timestampTz('sale_date');
            $table->string('status', 30)->default('completed');
            $table->string('payment_status', 30)->default('paid');
            $table->string('payment_method', 50)->nullable();
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('grand_total', 15, 2)->default(0);
            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->decimal('change_amount', 15, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('cancel_reason')->nullable();
            $table->timestampsTz();

            $table->index(['sale_date', 'status']);
            $table->index(['customer_id', 'sale_date']);
            $table->index(['cashier_id', 'sale_date']);
            $table->index(['payment_status', 'sale_date']);
        });

        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->string('product_sku', 80);
            $table->string('product_name', 180);
            $table->decimal('quantity', 12, 3);
            $table->decimal('unit_price', 15, 2);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('line_total', 15, 2);
            $table->timestampsTz();

            $table->index(['sale_id', 'product_id']);
            $table->index('product_id');
        });

        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->string('purchase_number', 50)->unique();
            $table->foreignId('supplier_id')->constrained('suppliers')->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('supplier_invoice_number', 80)->nullable();
            $table->timestampTz('purchase_date');
            $table->timestampTz('received_at')->nullable();
            $table->string('status', 30)->default('draft');
            $table->string('payment_status', 30)->default('unpaid');
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('shipping_cost', 15, 2)->default(0);
            $table->decimal('grand_total', 15, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestampsTz();

            $table->index(['supplier_id', 'purchase_date']);
            $table->index(['created_by', 'purchase_date']);
            $table->index(['status', 'purchase_date']);
            $table->index(['payment_status', 'purchase_date']);
        });

        Schema::create('purchase_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_id')->constrained('purchases')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->decimal('quantity', 12, 3);
            $table->decimal('unit_cost', 15, 2);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('line_total', 15, 2);
            $table->timestampsTz();

            $table->index(['purchase_id', 'product_id']);
            $table->index('product_id');
        });

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->foreignId('sale_id')->nullable()->constrained('sales')->restrictOnDelete();
            $table->foreignId('sale_item_id')->nullable()->constrained('sale_items')->restrictOnDelete();
            $table->foreignId('purchase_id')->nullable()->constrained('purchases')->restrictOnDelete();
            $table->foreignId('purchase_item_id')->nullable()->constrained('purchase_items')->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('movement_type', 30);
            $table->decimal('quantity_delta', 12, 3);
            $table->decimal('quantity_before', 12, 3);
            $table->decimal('quantity_after', 12, 3);
            $table->decimal('unit_cost', 15, 2)->nullable();
            $table->string('reference_number', 80)->nullable();
            $table->text('notes')->nullable();
            $table->timestampTz('movement_date');
            $table->timestampsTz();

            $table->index(['product_id', 'movement_date']);
            $table->index(['movement_type', 'movement_date']);
            $table->index(['sale_id', 'sale_item_id']);
            $table->index(['purchase_id', 'purchase_item_id']);
            $table->index(['created_by', 'movement_date']);
        });

        $this->addCheckConstraints();
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('purchase_items');
        Schema::dropIfExists('purchases');
        Schema::dropIfExists('sale_items');
        Schema::dropIfExists('sales');
        Schema::dropIfExists('products');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('suppliers');
        Schema::dropIfExists('users');
        Schema::dropIfExists('product_categories');
        Schema::dropIfExists('roles');
    }

    private function addCheckConstraints(): void
    {
        DB::statement('ALTER TABLE customers ADD CONSTRAINT customers_loyalty_points_non_negative CHECK (loyalty_points >= 0)');

        DB::statement('ALTER TABLE products ADD CONSTRAINT products_cost_price_non_negative CHECK (cost_price >= 0)');
        DB::statement('ALTER TABLE products ADD CONSTRAINT products_selling_price_non_negative CHECK (selling_price >= 0)');
        DB::statement('ALTER TABLE products ADD CONSTRAINT products_current_stock_non_negative CHECK (current_stock >= 0)');
        DB::statement('ALTER TABLE products ADD CONSTRAINT products_min_stock_non_negative CHECK (min_stock >= 0)');

        DB::statement('ALTER TABLE sales ADD CONSTRAINT sales_amounts_non_negative CHECK (subtotal >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND grand_total >= 0 AND paid_amount >= 0 AND change_amount >= 0)');
        DB::statement('ALTER TABLE sale_items ADD CONSTRAINT sale_items_values_valid CHECK (quantity > 0 AND unit_price >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND line_total >= 0)');

        DB::statement('ALTER TABLE purchases ADD CONSTRAINT purchases_amounts_non_negative CHECK (subtotal >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND shipping_cost >= 0 AND grand_total >= 0)');
        DB::statement('ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_values_valid CHECK (quantity > 0 AND unit_cost >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND line_total >= 0)');

        DB::statement('ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_quantity_delta_not_zero CHECK (quantity_delta <> 0)');
        DB::statement('ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_quantities_non_negative CHECK (quantity_before >= 0 AND quantity_after >= 0)');
    }
};
