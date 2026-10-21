<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QuestAttempt extends Model
{
    protected $fillable = [
        'player_id',
        'quest_id',
        'score',
        'total',
        'passed',
        'xp_earned',
        'coins_earned',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'passed' => 'boolean',
            'completed_at' => 'datetime',
        ];
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class);
    }

    public function quest(): BelongsTo
    {
        return $this->belongsTo(Quest::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(Answer::class);
    }
}
