<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quest_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained()->cascadeOnDelete();
            $table->foreignId('quest_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('score')->default(0);
            $table->unsignedSmallInteger('total')->default(0);
            $table->boolean('passed')->default(false);
            $table->unsignedSmallInteger('xp_earned')->default(0);
            $table->unsignedSmallInteger('coins_earned')->default(0);
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['player_id', 'quest_id']);
            $table->index('completed_at');
        });

        Schema::create('answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quest_attempt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('question_id')->constrained()->cascadeOnDelete();
            $table->foreignId('choice_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_correct')->default(false);
            $table->unsignedInteger('time_ms')->nullable();
            $table->timestamps();

            $table->unique(['quest_attempt_id', 'question_id']);
            $table->index(['question_id', 'is_correct']);
        });

        Schema::create('badges', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('description');
            $table->string('icon', 40)->default('award');
            // e.g. {"type": "quests_passed", "value": 3} or {"type": "topic_mastered", "topic": "sti-hiv"}
            $table->json('criteria');
            $table->timestamps();
        });

        Schema::create('badge_player', function (Blueprint $table) {
            $table->id();
            $table->foreignId('badge_id')->constrained()->cascadeOnDelete();
            $table->foreignId('player_id')->constrained()->cascadeOnDelete();
            $table->timestamp('earned_at');

            $table->unique(['badge_id', 'player_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('badge_player');
        Schema::dropIfExists('badges');
        Schema::dropIfExists('answers');
        Schema::dropIfExists('quest_attempts');
    }
};
