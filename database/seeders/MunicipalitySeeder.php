<?php

namespace Database\Seeders;

use App\Models\Municipality;
use Illuminate\Database\Seeder;

/**
 * Region XII (SOCCSKSARGEN) cities and municipalities.
 */
class MunicipalitySeeder extends Seeder
{
    public function run(): void
    {
        $region = [
            'South Cotabato' => [
                'cities' => ['Koronadal City'],
                'towns' => ['Banga', 'Lake Sebu', 'Norala', 'Polomolok', 'Santo Niño', 'Surallah', "T'boli", 'Tampakan', 'Tantangan', 'Tupi'],
            ],
            'General Santos City' => [
                'cities' => ['General Santos City'],
                'towns' => [],
            ],
            'Cotabato' => [
                'cities' => ['Kidapawan City'],
                'towns' => ['Alamada', 'Aleosan', 'Antipas', 'Arakan', 'Banisilan', 'Carmen', 'Kabacan', 'Libungan', "M'lang", 'Magpet', 'Makilala', 'Matalam', 'Midsayap', 'Pigcawayan', 'Pikit', 'President Roxas', 'Tulunan'],
            ],
            'Sultan Kudarat' => [
                'cities' => ['Tacurong City'],
                'towns' => ['Bagumbayan', 'Columbio', 'Esperanza', 'Isulan', 'Kalamansig', 'Lambayong', 'Lebak', 'Lutayan', 'Palimbang', 'President Quirino', 'Senator Ninoy Aquino'],
            ],
            'Sarangani' => [
                'cities' => [],
                'towns' => ['Alabel', 'Glan', 'Kiamba', 'Maasim', 'Maitum', 'Malapatan', 'Malungon'],
            ],
        ];

        foreach ($region as $province => $lists) {
            foreach ($lists['cities'] as $name) {
                Municipality::updateOrCreate(['province' => $province, 'name' => $name], ['is_city' => true]);
            }
            foreach ($lists['towns'] as $name) {
                Municipality::updateOrCreate(['province' => $province, 'name' => $name], ['is_city' => false]);
            }
        }
    }
}
