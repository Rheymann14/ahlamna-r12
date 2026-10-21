<?php

namespace App\Http\Controllers\Api\Play;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\Quest;
use App\Models\Zone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorldController extends Controller
{
    /**
     * Zones, locations (NPC spots) and quests, with this player's progress and lock state.
     */
    public function show(Request $request): JsonResponse
    {
        $player = $request->user();

        $best = $player->attempts()
            ->whereNotNull('completed_at')
            ->selectRaw('quest_id, MAX(passed) as passed, MAX(score) as best_score')
            ->groupBy('quest_id')
            ->get()
            ->keyBy('quest_id');

        $zones = Zone::orderBy('sort')
            ->with([
                'locations.topic',
                'locations.quests' => fn ($q) => $q->published()->withCount('publishedQuestions')->orderBy('sort'),
            ])
            ->get();

        return response()->json([
            'zones' => $zones->map(fn (Zone $zone) => [
                'slug' => $zone->slug,
                'name' => $zone->name,
                'description' => $zone->description,
                'unlock_level' => $zone->unlock_level,
                'locked' => $player->level < $zone->unlock_level,
                'locations' => $zone->locations->map(fn (Location $loc) => [
                    'slug' => $loc->slug,
                    'name' => $loc->name,
                    'npc_name' => $loc->npc_name,
                    'npc_role' => $loc->npc_role,
                    'npc_greeting' => $loc->npc_greeting,
                    'position' => [$loc->position_x, $loc->position_z],
                    'topic' => $loc->topic?->only(['slug', 'name', 'color']),
                    'quests' => $loc->quests->map(fn (Quest $quest) => [
                        'id' => $quest->id,
                        'title' => $quest->title,
                        'intro' => $quest->intro,
                        'type' => $quest->type,
                        'min_level' => $quest->min_level,
                        'question_count' => $quest->published_questions_count,
                        'xp_reward' => $quest->xp_reward,
                        'coin_reward' => $quest->coin_reward,
                        'locked' => $player->level < max($quest->min_level, $zone->unlock_level),
                        'passed' => (bool) ($best[$quest->id]->passed ?? false),
                        'best_score' => $best[$quest->id]->best_score ?? null,
                    ])->values(),
                ])->values(),
            ]),
        ]);
    }
}
