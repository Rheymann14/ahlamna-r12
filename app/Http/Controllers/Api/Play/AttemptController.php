<?php

namespace App\Http\Controllers\Api\Play;

use App\Http\Controllers\Controller;
use App\Models\Answer;
use App\Models\Quest;
use App\Models\QuestAttempt;
use App\Services\RewardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttemptController extends Controller
{
    /**
     * Starts a quest. Questions are returned without their correct answers;
     * each answer is checked by the server in answer().
     */
    public function start(Request $request, Quest $quest): JsonResponse
    {
        $player = $request->user();
        $quest->load('location.zone');

        abort_unless($quest->is_published, 404);
        abort_if(
            $player->level < max($quest->min_level, $quest->location->zone->unlock_level),
            403,
            'Level up to unlock this quest.'
        );

        $questions = $quest->publishedQuestions()->with('choices')->get();
        abort_if($questions->isEmpty(), 422, 'This quest has no questions yet.');

        $attempt = QuestAttempt::create([
            'player_id' => $player->id,
            'quest_id' => $quest->id,
            'total' => $questions->count(),
        ]);

        return response()->json([
            'attempt_id' => $attempt->id,
            'quest' => $quest->only(['id', 'title', 'intro', 'type']),
            'questions' => $questions->map->toPlayable()->values(),
        ], 201);
    }

    public function answer(Request $request, QuestAttempt $attempt): JsonResponse
    {
        $this->authorizeAttempt($request, $attempt);

        $data = $request->validate([
            'question_id' => ['required', 'integer'],
            'choice_id' => ['required', 'integer'],
            'time_ms' => ['nullable', 'integer', 'min:0', 'max:3600000'],
        ]);

        $question = $attempt->quest->publishedQuestions()->with('choices')->findOrFail($data['question_id']);
        $choice = $question->choices->firstWhere('id', $data['choice_id']);
        abort_unless($choice, 422, 'That choice does not belong to this question.');

        // First answer counts; re-sending the same question returns the stored result.
        $answer = Answer::firstOrCreate(
            ['quest_attempt_id' => $attempt->id, 'question_id' => $question->id],
            ['choice_id' => $choice->id, 'is_correct' => $choice->is_correct, 'time_ms' => $data['time_ms'] ?? null],
        );

        return response()->json([
            'is_correct' => $answer->is_correct,
            'correct_choice_id' => $question->choices->firstWhere('is_correct', true)?->id,
            'explanation' => $question->explanation,
        ]);
    }

    public function complete(Request $request, QuestAttempt $attempt, RewardService $rewards): JsonResponse
    {
        $this->authorizeAttempt($request, $attempt);

        return response()->json($rewards->complete($attempt));
    }

    private function authorizeAttempt(Request $request, QuestAttempt $attempt): void
    {
        abort_unless($attempt->player_id === $request->user()->id, 404);
        abort_if($attempt->completed_at !== null, 409, 'This attempt is already finished.');
    }
}
