<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Badge extends Model
{
    protected $fillable = ['slug', 'name', 'description', 'icon', 'criteria'];

    protected function casts(): array
    {
        return ['criteria' => 'array'];
    }

    public function players(): BelongsToMany
    {
        return $this->belongsToMany(Player::class)->withPivot('earned_at');
    }

    public function toPublic(): array
    {
        return [
            'slug' => $this->slug,
            'name' => $this->name,
            'description' => $this->description,
            'icon' => $this->icon,
            'earned_at' => $this->pivot?->earned_at,
        ];
    }
}
