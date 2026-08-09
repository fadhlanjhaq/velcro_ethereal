<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('site_contents', function (Blueprint $table) {
            $table->id();
            $table->string('section');
            $table->string('key');
            $table->text('value')->nullable();
            $table->enum('type', ['text', 'richtext', 'image', 'video', 'url'])
                ->default('text');
            $table->timestamps();

            // Satu key hanya boleh ada sekali per section — sekaligus jadi
            // pegangan untuk updateOrCreate saat seeding ulang.
            $table->unique(['section', 'key']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('site_contents');
    }
};
