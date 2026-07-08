<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class HeritageCollectionSeeder extends Seeder
{
    /**
     * PLACEHOLDER: base_price belum final, menunggu pricelist asli dari client.
     */
    private const PLACEHOLDER_BASE_PRICE = 850000;

    private const SIZES = ['S', 'M', 'L', 'XL'];

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $category = Category::where('slug', 'jaket')->firstOrFail();

        $products = [
            [
                'name' => 'Aurelia Knotwork Jacket',
                'sku_initials' => 'AKJ',
                'description' => 'Jaket dengan colorway Beige Brown, dihiasi bordir motif simpul keemasan.',
                'story' => 'Jaket bordir simpul keemasan yang mewah',
            ],
            [
                'name' => 'Verdant Knotwork Jacket',
                'sku_initials' => 'VKJ',
                'description' => 'Jaket dengan colorway Forest Green, dihiasi bordir motif simpul hijau.',
                'story' => 'Jaket bordir simpul hijau yang melambangkan kehidupan',
            ],
            [
                'name' => 'Cervus Grove Jacket',
                'sku_initials' => 'CGJ',
                'description' => 'Jaket bermotif rusa (cervus), terinspirasi hutan kecil yang sakral.',
                'story' => 'Cervus (rusa) — terinspirasi hutan kecil yang sakral',
            ],
            [
                'name' => 'Aureus Peacock Jacket',
                'sku_initials' => 'APJ',
                'description' => 'Jaket bermotif burung merak (aureus/emas), terinspirasi keindahannya.',
                'story' => 'Aureus (emas) — terinspirasi keindahan burung merak',
            ],
        ];

        foreach ($products as $data) {
            $product = Product::create([
                'category_id' => $category->id,
                'name' => $data['name'],
                'slug' => Str::slug($data['name']),
                'description' => $data['description'],
                'story' => $data['story'],
                'base_price' => self::PLACEHOLDER_BASE_PRICE,
            ]);

            foreach (self::SIZES as $size) {
                $product->variants()->create([
                    'size' => $size,
                    'sku' => "VE-{$data['sku_initials']}-{$size}",
                    'stock' => 10,
                ]);
            }
        }
    }
}
