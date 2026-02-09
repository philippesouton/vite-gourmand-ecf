<?php

namespace App\Service;

class JwtService
{
    private string $secret;

    public function __construct()
    {
        $this->secret = $_ENV['JWT_SECRET'] ?? $_SERVER['JWT_SECRET'] ?? getenv('JWT_SECRET') ?: 'dev_secret';
    }

    public function createToken(array $payload, int $ttlSeconds = 7200): string
    {
        $payload['exp'] = time() + $ttlSeconds;
        $header = ['alg' => 'HS256', 'typ' => 'JWT'];

        $headerEnc = $this->base64UrlEncode(json_encode($header, JSON_UNESCAPED_SLASHES));
        $payloadEnc = $this->base64UrlEncode(json_encode($payload, JSON_UNESCAPED_SLASHES));

        $signature = hash_hmac('sha256', $headerEnc . '.' . $payloadEnc, $this->secret, true);
        $sigEnc = $this->base64UrlEncode($signature);

        return $headerEnc . '.' . $payloadEnc . '.' . $sigEnc;
    }

    public function decodeToken(string $jwt): ?array
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            return null;
        }

        [$headerEnc, $payloadEnc, $sigEnc] = $parts;
        $expectedSig = $this->base64UrlEncode(hash_hmac('sha256', $headerEnc . '.' . $payloadEnc, $this->secret, true));

        if (!hash_equals($expectedSig, $sigEnc)) {
            return null;
        }

        $payloadJson = $this->base64UrlDecode($payloadEnc);
        $payload = json_decode($payloadJson, true);
        if (!is_array($payload)) {
            return null;
        }

        if (isset($payload['exp']) && time() > (int)$payload['exp']) {
            return null;
        }

        return $payload;
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $data): string
    {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode(strtr($data, '-_', '+/')) ?: '';
    }
}
