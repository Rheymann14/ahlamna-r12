<?php

namespace Database\Seeders;

use App\Models\Badge;
use Illuminate\Database\Seeder;

class BadgeSeeder extends Seeder
{
    public function run(): void
    {
        $badges = [
            ['first-steps', 'First steps', 'Pass your first quest.', 'footprints', ['type' => 'quests_passed', 'value' => 1]],
            ['explorer', 'Barangay explorer', 'Pass 4 different quests.', 'map', ['type' => 'quests_passed', 'value' => 4]],
            ['perfect', 'Perfect score', 'Get every answer right in a quest.', 'star', ['type' => 'perfect_score']],
            ['health-hero', 'Health hero', 'Master the HIV and STI topic.', 'heart-pulse', ['type' => 'topic_mastered', 'topic' => 'sti-hiv']],
            ['body-smart', 'Body smart', 'Master the puberty topic.', 'sparkles', ['type' => 'topic_mastered', 'topic' => 'puberty']],
            ['respect-champion', 'Respect champion', 'Master the consent and relationships topic.', 'handshake', ['type' => 'topic_mastered', 'topic' => 'consent']],
            ['level-3', 'Rising star', 'Reach level 3 and unlock Sultan Kudarat and Sarangani.', 'trending-up', ['type' => 'level', 'value' => 3]],
            ['streak-3', 'On a roll', 'Play 3 days in a row.', 'flame', ['type' => 'streak', 'value' => 3]],
        ];

        foreach ($badges as [$slug, $name, $description, $icon, $criteria]) {
            Badge::updateOrCreate(['slug' => $slug], compact('name', 'description', 'icon', 'criteria'));
        }
    }
}
