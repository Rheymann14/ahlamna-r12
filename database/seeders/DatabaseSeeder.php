<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Local development admin. Password is the UserFactory default: "password".
        User::factory()->create([
            'name' => 'Dev Admin',
            'email' => 'admin@ahlamna.test',
        ]);

        $this->call([
            MunicipalitySeeder::class,
            WorldSeeder::class,
            BadgeSeeder::class,
        ]);
    }
}
