<?php

namespace App\Services;

use App\Models\Badge;
use App\Models\Player;
use App\Models\Quest;
use App\Models\QuestAttempt;
use Illuminate\Support\Facades\DB;

class RewardService
{
    public const XP_PER_CORRECT = 10;

    public const COINS_PER_CORRECT = 5;

    /**
     * Scores a finished attempt, pays out XP/coins, updates level + streak and awards any new badges.
     *
     * Rules: every correct answer pays XP + coins; the quest's bonus is paid only on the
     * first pass; replays of an already-passed quest pay half so players can't farm rewards.
     */
    public function complete(QuestAttempt $attempt): array
    {
        return DB::transaction(function () use ($attempt) {
            $player = Player::lockForUpdate()->find($attempt->player_id);
            $quest = $attempt->quest;

            $score = $attempt->answers()->where('is_correct', true)->count();
            $total = max($attempt->total, 1);
            $passed = ($score / $total) * 100 >= $quest->pass_percent;

            $passedBefore = QuestAttempt::where('player_id', $player->id)
                ->where('quest_id', $quest->id)
                ->where('passed', true)
                ->whereKeyNot($attempt->id)
                ->exists();

            $xp = $score * self::XP_PER_CORRECT;
            $coins = $score * self::COINS_PER_CORRECT;

            if ($passedBefore) {
                $xp = intdiv($xp, 2);
                $coins = intdiv($coins, 2);
            } elseif ($passed) {
                $xp += $quest->xp_reward;
                $coins += $quest->coin_reward;
            }

            $attempt->update([
                'score' => $score,
                'passed' => $passed,
                'xp_earned' => $xp,
                'coins_earned' => $coins,
                'completed_at' => now(),
            ]);

            $oldLevel = $player->level;
            $player->xp += $xp;
            $player->coins += $coins;
            $player->level = Player::levelForXp($player->xp);
            $player->touchStreak();
            $player->save();

            $newBadges = $this->awardBadges($player);

            return [
                'score' => $score,
                'total' => $attempt->total,
                'passed' => $passed,
                'first_pass' => $passed && ! $passedBefore,
                'xp_earned' => $xp,
                'coins_earned' => $coins,
                'leveled_up' => $player->level > $oldLevel,
                'new_badges' => collect($newBadges)->map(fn (Badge $b) => $b->toPublic())->values(),
                'player' => $player->toProfile(),
            ];
        });
    }

    /**
     * @return Badge[] badges newly earned by this check
     */
    public function awardBadges(Player $player): array
    {
        $owned = $player->badges()->pluck('badges.id');
        $earned = [];

        foreach (Badge::whereNotIn('id', $owned)->get() as $badge) {
            if ($this->meets($player, $badge->criteria)) {
                $player->badges()->attach($badge->id, ['earned_at' => now()]);
                $earned[] = $badge;
            }
        }

        return $earned;
    }

    private function meets(Player $player, array $criteria): bool
    {
        $passedQuestIds = fn () => $player->attempts()->where('passed', true)->distinct()->pluck('quest_id');

        return match ($criteria['type'] ?? null) {
            'quests_passed' => $passedQuestIds()->count() >= ($criteria['value'] ?? 1),
            'perfect_score' => $player->attempts()->whereNotNull('completed_at')->where('total', '>', 0)->whereColumn('score', 'total')->exists(),
            'level' => $player->level >= ($criteria['value'] ?? 1),
            'streak' => $player->streak_days >= ($criteria['value'] ?? 1),
            'topic_mastered' => $this->masteredTopic($passedQuestIds(), $criteria['topic'] ?? ''),
            default => false,
        };
    }

    private function masteredTopic($passedQuestIds, string $topicSlug): bool
    {
        $topicQuestIds = Quest::published()
            ->whereHas('location.topic', fn ($q) => $q->where('slug', $topicSlug))
            ->pluck('id');

        return $topicQuestIds->isNotEmpty() && $topicQuestIds->diff($passedQuestIds)->isEmpty();
    }
}
