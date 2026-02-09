<?php

namespace App\Service;

class EmailLogger
{
    private Db $db;

    public function __construct(Db $db)
    {
        $this->db = $db;
    }

    public function log(string $to, string $subject, string $body, string $kind, ?string $relatedId = null): void
    {
        try {
            $this->db->execute(
                'INSERT INTO email_log (to_email, subject, body, kind, related_id) VALUES ($1,$2,$3,$4,$5)',
                [$to, $subject, $body, $kind, $relatedId]
            );
        } catch (\Throwable $e) {
            // do not block on log errors
        }
    }
}
