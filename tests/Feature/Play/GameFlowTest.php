<?php

namespace Tests\Feature\Play;

use App\Models\Player;
use App\Models\Quest;
use App\Models\User;
use Database\Seeders\BadgeSeeder;
use Database\Seeders\MunicipalitySeeder;
use Database\Seeders\WorldSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GameFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([MunicipalitySeeder::class, WorldSeeder::class, BadgeSeeder::class]);
    }

    private function register(string $nickname = 'Kulas_GenSan'): array
    {
        return $this->postJson('/api/play/register', [
            'nickname' => $nickname,
            'pin' => '4821',
            'age_group' => '15-19',
            'sex' => 'prefer_not',
        ])->assertCreated()->json();
    }

    public function test_player_can_register_and_log_in_with_nickname_and_pin()
    {
        $this->register();

        $this->postJson('/api/play/login', ['nickname' => 'Kulas_GenSan', 'pin' => '0000'])
            ->assertStatus(422);

        $this->postJson('/api/play/login', ['nickname' => 'Kulas_GenSan', 'pin' => '4821'])
            ->assertOk()
            ->assertJsonPath('player.level', 1)
            ->assertJsonStructure(['token']);
    }

    public function test_world_shows_lakeside_locked_for_new_players()
    {
        $token = $this->register()['token'];

        $world = $this->withToken($token)->getJson('/api/play/world')->assertOk()->json('zones');

        $this->assertFalse($world[0]['locked']);
        $this->assertTrue($world[1]['locked']);
        $this->assertCount(4, $world[0]['locations']);
    }

    public function test_questions_never_reveal_correct_answers()
    {
        $token = $this->register()['token'];
        $quest = Quest::whereHas('location', fn ($q) => $q->where('slug', 'loc_health_center'))->first();

        $res = $this->withToken($token)->postJson("/api/play/quests/{$quest->id}/attempts")->assertCreated();

        $this->assertStringNotContainsString('is_correct', $res->getContent());
        $this->assertStringNotContainsString('explanation', $res->getContent());
    }

    public function test_locked_quests_cannot_be_started()
    {
        $token = $this->register()['token'];
        $quest = Quest::whereHas('location', fn ($q) => $q->where('slug', 'loc_lakeside'))->first();

        $this->withToken($token)->postJson("/api/play/quests/{$quest->id}/attempts")->assertForbidden();
    }

    public function test_perfect_quest_pays_rewards_levels_up_and_awards_badges()
    {
        $token = $this->register()['token'];
        $quest = Quest::with('publishedQuestions.choices')
            ->whereHas('location', fn ($q) => $q->where('slug', 'loc_health_center'))->first();

        $attemptId = $this->withToken($token)->postJson("/api/play/quests/{$quest->id}/attempts")->json('attempt_id');

        foreach ($quest->publishedQuestions as $question) {
            $this->withToken($token)->postJson("/api/play/attempts/{$attemptId}/answers", [
                'question_id' => $question->id,
                'choice_id' => $question->choices->firstWhere('is_correct', true)->id,
                'time_ms' => 4000,
            ])->assertOk()->assertJsonPath('is_correct', true);
        }

        $result = $this->withToken($token)->postJson("/api/play/attempts/{$attemptId}/complete")->assertOk()->json();

        // 5 correct x 10 XP + 50 first-pass bonus = 100 XP -> level 2
        $this->assertSame(5, $result['score']);
        $this->assertTrue($result['passed']);
        $this->assertSame(100, $result['xp_earned']);
        $this->assertSame(45, $result['coins_earned']);
        $this->assertTrue($result['leveled_up']);
        $this->assertSame(2, $result['player']['level']);
        $this->assertEqualsCanonicalizing(
            ['first-steps', 'perfect', 'health-hero'],
            collect($result['new_badges'])->pluck('slug')->all(),
        );

        // A finished attempt cannot be submitted again.
        $this->withToken($token)->postJson("/api/play/attempts/{$attemptId}/complete")->assertStatus(409);
    }

    public function test_replaying_a_passed_quest_pays_half_and_no_bonus()
    {
        $token = $this->register()['token'];
        $quest = Quest::with('publishedQuestions.choices')
            ->whereHas('location', fn ($q) => $q->where('slug', 'loc_school'))->first();

        $play = function () use ($token, $quest) {
            $id = $this->withToken($token)->postJson("/api/play/quests/{$quest->id}/attempts")->json('attempt_id');
            foreach ($quest->publishedQuestions as $question) {
                $this->withToken($token)->postJson("/api/play/attempts/{$id}/answers", [
                    'question_id' => $question->id,
                    'choice_id' => $question->choices->firstWhere('is_correct', true)->id,
                ]);
            }

            return $this->withToken($token)->postJson("/api/play/attempts/{$id}/complete")->json();
        };

        $this->assertSame(100, $play()['xp_earned']);
        $this->assertSame(25, $play()['xp_earned']);
    }

    public function test_players_cannot_touch_other_players_attempts()
    {
        $alice = $this->register('alice')['token'];
        $bob = $this->register('bob')['token'];
        $quest = Quest::whereHas('location', fn ($q) => $q->where('slug', 'loc_home'))->first();

        $attemptId = $this->withToken($alice)->postJson("/api/play/quests/{$quest->id}/attempts")->json('attempt_id');

        $this->app['auth']->forgetGuards();
        $this->withToken($bob)->postJson("/api/play/attempts/{$attemptId}/complete")->assertNotFound();
    }

    public function test_admin_users_cannot_use_game_routes()
    {
        $this->actingAs(User::factory()->create(), 'sanctum');

        $this->getJson('/api/play/world')->assertUnauthorized();
    }

    public function test_level_curve()
    {
        $this->assertSame(1, Player::levelForXp(99));
        $this->assertSame(2, Player::levelForXp(100));
        $this->assertSame(3, Player::levelForXp(250));
        $this->assertSame(4, Player::levelForXp(450));
    }
}
