<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Location extends Model
{
    protected $fillable = [
        'zone_id',
        'topic_id',
        'slug',
        'name',
        'npc_name',
        'npc_role',
        'npc_greeting',
        'position_x',
        'position_z',
    ];

    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class);
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(Topic::class);
    }

    public function quests(): HasMany
    {
        return $this->hasMany(Quest::class);
    }
}
