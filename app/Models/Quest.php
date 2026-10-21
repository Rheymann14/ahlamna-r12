<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Quest extends Model
{
    protected $fillable = [
        'location_id',
        'title',
        'intro',
        'type',
        'min_level',
        'xp_reward',
        'coin_reward',
        'pass_percent',
        'is_published',
        'sort',
    ];

    protected function casts(): array
    {
        return ['is_published' => 'boolean'];
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class);
    }

    public function publishedQuestions(): HasMany
    {
        return $this->questions()->where('status', 'published')->orderBy('sort');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(QuestAttempt::class);
    }

    public function scopePublished(Builder $query): void
    {
        $query->where('is_published', true);
    }
}
