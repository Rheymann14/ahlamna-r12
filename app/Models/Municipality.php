<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Municipality extends Model
{
    protected $fillable = ['name', 'province', 'is_city'];

    protected function casts(): array
    {
        return ['is_city' => 'boolean'];
    }

    public function schools(): HasMany
    {
        return $this->hasMany(School::class);
    }

    public function players(): HasMany
    {
        return $this->hasMany(Player::class);
    }
}
