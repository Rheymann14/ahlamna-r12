<?php

namespace App\Http\Controllers\Api\Play;

use App\Http\Controllers\Controller;
use App\Models\Municipality;
use App\Models\Player;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Data needed by the sign-up form.
     */
    public function meta(): JsonResponse
    {
        return response()->json([
            'age_groups' => Player::AGE_GROUPS,
            'sexes' => Player::SEXES,
            'municipalities' => Municipality::orderBy('province')->orderBy('name')->get(['id', 'name', 'province']),
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nickname' => ['required', 'string', 'min:3', 'max:20', 'regex:/^[A-Za-z0-9_]+$/', 'unique:players,nickname'],
            'pin' => ['required', 'digits_between:4,6'],
            'age_group' => ['required', Rule::in(Player::AGE_GROUPS)],
            'sex' => ['required', Rule::in(Player::SEXES)],
            'municipality_id' => ['nullable', 'exists:municipalities,id'],
            'class_code' => ['nullable', 'string', 'max:20'],
        ], [
            'nickname.regex' => 'Use letters, numbers and underscores only.',
            'nickname.unique' => 'That nickname is taken. Try another.',
        ]);

        $player = Player::create($data);

        return response()->json([
            'token' => $player->createToken('play')->plainTextToken,
            'player' => $player->toProfile(),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nickname' => ['required', 'string'],
            'pin' => ['required', 'string'],
        ]);

        $player = Player::where('nickname', $data['nickname'])->first();

        if (! $player || ! Hash::check($data['pin'], $player->pin)) {
            throw ValidationException::withMessages(['nickname' => 'Wrong nickname or PIN.']);
        }

        return response()->json([
            'token' => $player->createToken('play')->plainTextToken,
            'player' => $player->toProfile(),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['ok' => true]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['player' => $request->user()->toProfile()]);
    }
}
