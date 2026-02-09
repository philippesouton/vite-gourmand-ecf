<?php

namespace App\Util;

class ApiUtils
{
    public static function round2(float $n): float
    {
        return round($n + 1e-9, 2);
    }

    public static function isBordeaux(?string $city): bool
    {
        return trim(mb_strtolower((string)$city)) === 'bordeaux';
    }

    public static function generateOrderNumber(): string
    {
        return 'VG-' . time() . '-' . strtoupper(bin2hex(random_bytes(4)));
    }

    public static function isStrongPassword(string $pw): bool
    {
        return (bool)preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/', $pw);
    }

    public static function computePricing(array $menu, int $persons, string $city, float $distanceKm): array
    {
        $min = (int)($menu['minPersons'] ?? $menu['nombre_personne_minimum'] ?? 0);
        $unit = (float)($menu['pricePerPerson'] ?? $menu['prix_par_personne'] ?? 0);

        if ($persons <= 0 || $persons < $min) {
            throw new \RuntimeException('persons below minimum');
        }

        $brut = self::round2($persons * $unit);
        $reductionPercent = $persons >= ($min + 5) ? 10 : 0;
        $reductionEur = self::round2($brut * ($reductionPercent / 100));
        $net = self::round2($brut - $reductionEur);

        $km = 0;
        $delivery = 0;
        if (!self::isBordeaux($city)) {
            if ($distanceKm < 0) throw new \RuntimeException('distanceKm required outside Bordeaux');
            $km = $distanceKm;
            $delivery = self::round2(5 + 0.59 * $km);
        }
        $total = self::round2($net + $delivery);

        return [
            'brut' => $brut,
            'reductionPercent' => $reductionPercent,
            'reductionEur' => $reductionEur,
            'net' => $net,
            'km' => $km,
            'delivery' => $delivery,
            'total' => $total,
        ];
    }
}
