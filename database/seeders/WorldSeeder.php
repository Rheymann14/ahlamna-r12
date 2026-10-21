<?php

namespace Database\Seeders;

use App\Models\Location;
use App\Models\Quest;
use App\Models\Topic;
use App\Models\Zone;
use Illuminate\Database\Seeder;


/**
 * Starter world: Region XII's provinces as zones, an NPC in each main town, and five quests.
 *
 * Positions are world meters with Koronadal City at (0, 0); 1 pixel on the reference map = 3 m
 * (see resources/js/play/world/region.ts, which uses the same conversion). Buildings sit beside the
 * roads and landmarks laid out in resources/js/play/world/landmarks.ts.
 *
 * NOTE: The questions below are SAMPLE content for development. They must go through
 * medical/content review (e.g. DOH CHD XII, CPD XII) before being used with real players.
 */
class WorldSeeder extends Seeder
{
    /** Map pixel -> world meters (Koronadal City is the origin). */
    private static function world(float $px, float $py): array
    {
        return [($px - 457) * 3, ($py - 320) * 3];
    }

    public function run(): void
    {
        $topics = collect([
            ['puberty', 'Puberty and body changes', '#378ADD'],
            ['sti-hiv', 'HIV and STIs', '#E24B4A'],
            ['health-habits', 'Nutrition and healthy habits', '#BA7517'],
            ['consent', 'Consent and relationships', '#7F77DD'],
            ['mental-health', 'Mental health', '#1D9E75'],
            ['online-safety', 'Online safety', '#D4537E'],
            ['gender', 'Gender and equality', '#534AB7'],
            ['teen-pregnancy', 'Teen pregnancy prevention', '#D85A30'],
            ['substance-use', 'Smoking, vaping and alcohol', '#639922'],
        ])->mapWithKeys(fn ($t) => [$t[0] => Topic::updateOrCreate(['slug' => $t[0]], ['name' => $t[1], 'color' => $t[2]])]);

        // Zones are the provinces of Region XII, opened one by one as players level up.
        $zoneData = [
            ['south-cotabato', 'South Cotabato', 'Home of Koronadal City and Lake Sebu.', 1],
            ['general-santos', 'General Santos City', 'The Tuna Capital and its busy fish port.', 2],
            ['sultan-kudarat', 'Sultan Kudarat', 'Isulan, Tacurong and the rice fields of the west.', 3],
            ['sarangani', 'Sarangani', 'Coastal towns around Sarangani Bay.', 3],
            ['cotabato', 'Cotabato', 'Kidapawan City at the foot of Mt. Apo.', 4],
        ];
        $zones = [];
        foreach ($zoneData as $i => [$slug, $name, $description, $level]) {
            $zones[$slug] = Zone::updateOrCreate(['slug' => $slug], [
                'name' => $name,
                'description' => $description,
                'unlock_level' => $level,
                'sort' => $i + 1,
            ]);
        }
        Zone::whereNotIn('slug', array_keys($zones))->delete();

        [$sebuX, $sebuZ] = self::world(432, 380);
        [$gsX, $gsZ] = self::world(532, 410);
        [$isX, $isZ] = self::world(396, 287);
        [$alX, $alZ] = self::world(572, 420);
        [$kiX, $kiZ] = self::world(520, 190);

        // [zone, topic, slug, name, npc, role, greeting, x, z] — x/z is the building's center.
        $locations = [
            ['south-cotabato', 'puberty', 'loc_school', 'Koronadal National High School', 'Sir Ben', 'Guidance teacher', 'Hello! Growing up comes with lots of questions. Let\'s talk about them.', -50, 30],
            ['south-cotabato', 'sti-hiv', 'loc_health_center', 'Teen Health Center', 'Ate Nena', 'Nurse', 'Maayong adlaw! Everything you ask here is confidential.', 50, 22],
            ['south-cotabato', 'health-habits', 'loc_home', 'Bahay ni Lola', 'Lola Pacing', 'Grandmother', 'Come in, iho, iha! A healthy body starts at home.', -36, 50],
            ['south-cotabato', 'consent', 'loc_plaza', 'Youth Hub at the Plaza', 'Kuya Migs', 'Peer educator', 'Hey! Respect is the coolest thing you can have. Want to test what you know?', 10, 34],
            ['south-cotabato', 'mental-health', 'loc_lake_sebu', 'Lake Sebu Wellness Spot', 'Inday Lia', 'Youth counselor', 'Breathe in, breathe out. Let\'s take care of your mind today.', $sebuX - 16, $sebuZ - 8],
            ['general-santos', 'online-safety', 'loc_gensan_port', 'Fish Port Youth Corner', 'Kuya Dodong', 'Youth volunteer', 'Welcome to GenSan! Online, stay as careful as you are at sea.', $gsX - 14, $gsZ + 30],
            ['sultan-kudarat', 'gender', 'loc_isulan_youth', 'Isulan Youth Center', 'Ma\'am Aisha', 'Youth development officer', 'Assalamu alaikum! Everyone deserves equal respect and chances.', $isX - 24, $isZ - 18],
            ['sarangani', 'teen-pregnancy', 'loc_alabel_capitol', 'Sarangani Youth Desk', 'Ate Jing', 'Population officer', 'Hello from Alabel! Let\'s talk about planning your future.', $alX - 20, $alZ - 24],
            ['cotabato', 'substance-use', 'loc_kidapawan_hub', 'Kidapawan Youth Hub', 'Kuya Rey', 'Health educator', 'Fresh air from Mt. Apo! Let\'s keep your lungs and mind healthy.', $kiX - 40, $kiZ + 10],
        ];

        foreach ($locations as [$zone, $topic, $slug, $name, $npc, $role, $greeting, $x, $z]) {
            Location::updateOrCreate(['slug' => $slug], [
                'zone_id' => $zones[$zone]->id,
                'topic_id' => $topics[$topic]->id,
                'name' => $name,
                'npc_name' => $npc,
                'npc_role' => $role,
                'npc_greeting' => $greeting,
                'position_x' => $x,
                'position_z' => $z,
            ]);
        }
        Location::whereNotIn('slug', array_column($locations, 2))->delete();

        foreach ($this->quests() as $slug => $quest) {
            $location = Location::where('slug', $slug)->first();
            $model = Quest::updateOrCreate(
                ['location_id' => $location->id, 'title' => $quest['title']],
                ['intro' => $quest['intro'], 'type' => 'quiz', 'min_level' => $quest['min_level'] ?? 1, 'xp_reward' => 50, 'coin_reward' => 20, 'is_published' => true],
            );

            $model->questions()->delete();
            foreach ($quest['questions'] as $i => [$prompt, $choices, $correct, $explanation]) {
                $question = $model->questions()->create([
                    'topic_id' => $location->topic_id,
                    'type' => count($choices) === 2 ? 'true_false' : 'multiple_choice',
                    'prompt' => $prompt,
                    'explanation' => $explanation,
                    'status' => 'published',
                    'sort' => $i,
                ]);
                foreach ($choices as $j => $label) {
                    $question->choices()->create(['label' => $label, 'is_correct' => $j === $correct, 'sort' => $j]);
                }
            }
        }
    }

    /**
     * location slug => quest. Each question: [prompt, choices, index of correct choice, explanation].
     */
    private function quests(): array
    {
        return [
            'loc_school' => [
                'title' => 'Growing up 101',
                'intro' => 'Sir Ben wants to clear up some common questions about puberty.',
                'questions' => [
                    ['Puberty usually starts at what age?', ['Between 8 and 14', 'Only at 18', 'Before age 5', 'It is the same day for everyone'], 0, 'Puberty usually starts between ages 8 and 14. Everyone has their own timing, and that is normal.'],
                    ['Menstruation (having a period) is…', ['A sign of sickness', 'A normal monthly body process', 'Something to be ashamed of', 'Only for adults over 20'], 1, 'Menstruation is a normal, healthy part of growing up for girls and people with a uterus.'],
                    ['Can a person get pregnant the first time they have sex?', ['Yes', 'No'], 0, 'Yes. Pregnancy can happen any time sperm meets an egg, including the first time.'],
                    ['Which hormones cause most puberty changes?', ['Insulin and adrenaline', 'Estrogen and testosterone', 'Vitamin C and iron', 'Caffeine and sugar'], 1, 'Estrogen and testosterone drive most body changes during puberty.'],
                    ['Wet dreams during puberty are…', ['A sign of illness', 'Normal and common', 'Something that must be treated', 'Caused by bad behavior'], 1, 'Wet dreams (nocturnal emissions) are a normal part of puberty for boys.'],
                ],
            ],
            'loc_health_center' => [
                'title' => 'HIV and STI facts',
                'intro' => 'Ate Nena is busting myths about HIV and STIs. Can you help her?',
                'questions' => [
                    ['Can you tell if someone has HIV just by looking at them?', ['Yes, they look sick', 'No, only a test can tell'], 1, 'Many people with HIV look and feel healthy for years. Only an HIV test can tell.'],
                    ['Which of these can pass HIV from one person to another?', ['Hugging', 'Sharing spoons and plates', 'Sharing needles', 'Mosquito bites'], 2, 'HIV spreads through blood, semen, vaginal fluids and breast milk, for example by sharing needles or unprotected sex. It does not spread through hugs, utensils or mosquitoes.'],
                    ['Which method helps prevent BOTH pregnancy and STIs?', ['Birth control pills', 'Condoms', 'Withdrawal', 'Counting days'], 1, 'Condoms, used correctly every time, help prevent both pregnancy and STIs, including HIV. Pills prevent pregnancy only.'],
                    ['Can a person have an STI without any symptoms?', ['Yes', 'No'], 0, 'Yes. Many STIs have no symptoms at first, so testing is the only way to know.'],
                    ['Under the Philippine HIV and AIDS Policy Act (RA 11166), from what age can a young person consent to their own HIV test?', ['12', '15', '18', '21'], 1, 'Young people aged 15 to 17 can consent to HIV testing themselves, with the help of a trained health worker or counselor.'],
                ],
            ],
            'loc_home' => [
                'title' => 'Healthy at home',
                'intro' => 'Lola Pacing is cooking. Help her plan healthy habits for the family.',
                'questions' => [
                    ['Using Pinggang Pinoy, about how much of your plate should be fruits and vegetables?', ['None', 'About one quarter', 'About half', 'All of it'], 2, 'Pinggang Pinoy recommends about half the plate as fruits and vegetables, with rice and protein foods sharing the rest.'],
                    ['Which nutrient helps prevent anemia, common among teenage girls?', ['Iron', 'Sugar', 'Salt', 'Caffeine'], 0, 'Iron helps make healthy blood. Good sources are malunggay, kangkong, liver, fish, meat and beans.'],
                    ['How many hours of sleep do teenagers need each night?', ['4 to 5', '6', '8 to 10', '12 to 14'], 2, 'Teens need about 8 to 10 hours of sleep to grow, learn and stay healthy.'],
                    ['What is the healthiest drink to have every day?', ['Soft drinks', 'Water', 'Energy drinks', 'Milk tea'], 1, 'Water is the best everyday drink. Sugary drinks add calories without nutrients.'],
                    ['What is a good way to talk with a parent about a sensitive topic?', ['Wait until they are angry or busy', 'Pick a calm time and be honest', 'Ask through a friend only', 'Never talk about it'], 1, 'Choosing a calm moment and being honest makes it easier for both of you to listen.'],
                ],
            ],
            'loc_plaza' => [
                'title' => 'Respect and consent',
                'intro' => 'Kuya Migs runs a youth talk at the plaza. Show what you know about respect.',
                'questions' => [
                    ['Consent means…', ['Saying yes once means yes forever', 'A clear, free yes that can be taken back anytime', 'Not saying no', 'Doing what your partner wants'], 1, 'Consent is a clear and freely given yes. Anyone can change their mind at any time.'],
                    ['Can someone who is drunk or asleep give consent?', ['Yes', 'No'], 1, 'No. A person who is drunk, asleep or unconscious cannot give consent.'],
                    ['Your partner checks your phone and decides who you can talk to. This is…', ['A sign of true love', 'A warning sign of an unhealthy relationship', 'Normal for all couples', 'Your fault'], 1, 'Controlling who you talk to and checking your phone are warning signs. Healthy relationships are built on trust and respect.'],
                    ['Someone pressures you to send a private or sexy photo. What should you do?', ['Send it so they stop asking', 'Say no and tell a trusted adult', 'Send a friend\'s photo instead', 'Keep it a secret'], 1, 'Say no and tell a trusted adult. Sharing sexual images of anyone under 18 is a crime in the Philippines, and it is never your fault if someone pressures you.'],
                    ['In the Philippines, what is the age of sexual consent under RA 11648?', ['12', '14', '16', '18'], 2, 'RA 11648 (2022) raised the age of sexual consent from 12 to 16 to better protect children.'],
                ],
            ],
            'loc_lake_sebu' => [
                'title' => 'Mind matters',
                'min_level' => 2,
                'intro' => 'Inday Lia wants to help you care for your mental health.',
                'questions' => [
                    ['You have felt very sad and lost interest in things for more than two weeks. What should you do?', ['Keep it to yourself', 'Talk to a trusted adult or counselor', 'Wait for it to pass on its own', 'Post about it online only'], 1, 'Feeling this way for two weeks or more is a sign to reach out. Talking to someone you trust is a strong first step.'],
                    ['Which is a healthy way to cope with stress?', ['Drinking alcohol', 'Skipping meals', 'Exercise, rest and talking to someone', 'Staying awake all night'], 2, 'Moving your body, getting enough rest and talking to someone are healthy ways to handle stress.'],
                    ['What number can you call for the National Center for Mental Health crisis hotline?', ['911', '1553', '117', '8888'], 1, 'The NCMH crisis hotline is 1553 (toll-free on landline nationwide). Help is available 24/7.'],
                    ['Does asking a friend directly if they are thinking of suicide put the idea in their head?', ['Yes', 'No'], 1, 'No. Asking directly and caring shows them they can talk to you, and can help them get support.'],
                    ['Mental health is part of your overall health.', ['True', 'False'], 0, 'True. Taking care of your mind is as important as taking care of your body.'],
                ],
            ],
        ];
    }
}
