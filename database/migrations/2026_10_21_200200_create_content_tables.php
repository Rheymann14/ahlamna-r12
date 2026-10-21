<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('topics', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('color', 7)->default('#888780');
            $table->timestamps();
        });

        // A zone is a district of the open world, unlocked by player level.
        Schema::create('zones', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('unlock_level')->default(1);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
        });

        // A location is a named spot in the 3D world (a building + its NPC).
        // `slug` matches the spot name in the world layout, so admins can re-assign content without touching the map.
        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('zone_id')->constrained()->cascadeOnDelete();
            $table->foreignId('topic_id')->nullable()->constrained()->nullOnDelete();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('npc_name');
            $table->string('npc_role')->nullable();
            $table->text('npc_greeting')->nullable();
            $table->float('position_x')->default(0);
            $table->float('position_z')->default(0);
            $table->timestamps();
        });

        Schema::create('quests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('intro')->nullable();
            $table->string('type', 20)->default('quiz'); // quiz, myth_fact, scenario
            $table->unsignedSmallInteger('min_level')->default(1);
            $table->unsignedSmallInteger('xp_reward')->default(50); // bonus on first pass
            $table->unsignedSmallInteger('coin_reward')->default(20);
            $table->unsignedTinyInteger('pass_percent')->default(60);
            $table->boolean('is_published')->default(false);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quest_id')->constrained()->cascadeOnDelete();
            $table->foreignId('topic_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 20)->default('multiple_choice'); // multiple_choice, true_false
            $table->text('prompt');
            $table->text('explanation')->nullable();
            $table->unsignedTinyInteger('difficulty')->default(1); // 1 easy, 2 medium, 3 hard
            $table->string('language', 5)->default('en');
            $table->string('status', 20)->default('draft'); // draft, in_review, published, archived
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();

            $table->index(['quest_id', 'status']);
        });

        Schema::create('choices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('question_id')->constrained()->cascadeOnDelete();
            $table->string('label');
            $table->boolean('is_correct')->default(false);
            $table->unsignedTinyInteger('sort')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('choices');
        Schema::dropIfExists('questions');
        Schema::dropIfExists('quests');
        Schema::dropIfExists('locations');
        Schema::dropIfExists('zones');
        Schema::dropIfExists('topics');
    }
};
