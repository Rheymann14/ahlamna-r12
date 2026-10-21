<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Topic extends Model
{
    protected $fillable = ['slug', 'name', 'description', 'color'];

    public function locations(): HasMany
    {
        return $this->hasMany(Location::class);
    }

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class);
    }
}
