<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class Player extends Authenticatable
{
    use HasApiTokens;

    public const AGE_GROUPS = ['10-14', '15-19', '20-24'];

    public const SEXES = ['female', 'male', 'prefer_not'];

    protected $fillable = [
        'nickname',
        'pin',
        'age_group',
        'sex',
        'municipality_id',
        'school_id',
        'class_code',
        'language',
        'avatar',
    ];

    protected $hidden = [
        'pin',
    ];

    protected $attributes = [
        'language' => 'en',
        'xp' => 0,
        'coins' => 0,
        'level' => 1,
        'streak_days' => 0,
    ];

    protected function casts(): array
    {
        return [
            'pin' => 'hashed',
            'avatar' => 'array',
            'last_played_on' => 'date',
        ];
    }

    public function municipality(): BelongsTo
    {
        return $this->belongsTo(Municipality::class);
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(QuestAttempt::class);
    }

    public function badges(): BelongsToMany
    {
        return $this->belongsToMany(Badge::class)->withPivot('earned_at');
    }

    /**
     * Total XP needed to reach the given level. Each level costs 50 XP more than the last:
     * L2 = 100, L3 = 250, L4 = 450, L5 = 700 ...
     */
    public static function xpForLevel(int $level): int
    {
        $n = $level - 1;

        return 100 * $n + 25 * $n * ($n - 1);
    }

    public static function levelForXp(int $xp): int
    {
        $level = 1;
        while (self::xpForLevel($level + 1) <= $xp) {
            $level++;
        }

        return $level;
    }

    /**
     * Updates the daily streak: +1 if last played yesterday, reset to 1 if a day was missed.
     */
    public function touchStreak(): void
    {
        $today = now()->startOfDay();

        if ($this->last_played_on?->equalTo($today)) {
            return;
        }

        $this->streak_days = $this->last_played_on?->equalTo($today->copy()->subDay())
            ? $this->streak_days + 1
            : 1;
        $this->last_played_on = $today;
    }

    public function toProfile(): array
    {
        return [
            'id' => $this->id,
            'nickname' => $this->nickname,
            'age_group' => $this->age_group,
            'language' => $this->language,
            'avatar' => $this->avatar,
            'xp' => $this->xp,
            'coins' => $this->coins,
            'level' => $this->level,
            'level_xp_start' => self::xpForLevel($this->level),
            'level_xp_end' => self::xpForLevel($this->level + 1),
            'streak_days' => $this->streak_days,
            'badges' => $this->badges()->orderByPivot('earned_at')->get()->map(fn (Badge $b) => $b->toPublic()),
        ];
    }
}
