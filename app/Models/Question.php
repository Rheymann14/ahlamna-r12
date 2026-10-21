<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Question extends Model
{
    protected $fillable = [
        'quest_id',
        'topic_id',
        'type',
        'prompt',
        'explanation',
        'difficulty',
        'language',
        'status',
        'sort',
    ];

    public function quest(): BelongsTo
    {
        return $this->belongsTo(Quest::class);
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(Topic::class);
    }

    public function choices(): HasMany
    {
        return $this->hasMany(Choice::class)->orderBy('sort');
    }

    public function answers(): HasMany
    {
        return $this->hasMany(Answer::class);
    }

    /**
     * Shape sent to players: never includes which choice is correct.
     */
    public function toPlayable(): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'prompt' => $this->prompt,
            'choices' => $this->choices->map(fn (Choice $c) => ['id' => $c->id, 'label' => $c->label])->values(),
        ];
    }
}
