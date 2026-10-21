<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Zone extends Model
{
    protected $fillable = ['slug', 'name', 'description', 'unlock_level', 'sort'];

    public function locations(): HasMany
    {
        return $this->hasMany(Location::class);
    }
}
