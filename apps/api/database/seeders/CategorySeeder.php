<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        foreach (['Baju', 'Jaket', 'Celana'] as $name) {
            Category::create([
                'name' => $name,
                'slug' => Str::slug($name),
            ]);
        }
    }
}
