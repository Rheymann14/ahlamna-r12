<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Players are pseudonymous: a nickname + PIN, no real names, emails or phone numbers.
        Schema::create('players', function (Blueprint $table) {
            $table->id();
            $table->string('nickname', 30)->unique();
            $table->string('pin');
            $table->string('age_group', 10); // 10-14, 15-19, 20-24
            $table->string('sex', 20); // female, male, prefer_not
            $table->foreignId('municipality_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('school_id')->nullable()->constrained()->nullOnDelete();
            $table->string('class_code', 20)->nullable()->index();
            $table->string('language', 5)->default('en');
            $table->json('avatar')->nullable();
            $table->unsignedInteger('xp')->default(0);
            $table->unsignedInteger('coins')->default(0);
            $table->unsignedSmallInteger('level')->default(1);
            $table->unsignedSmallInteger('streak_days')->default(0);
            $table->date('last_played_on')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('players');
    }
};
