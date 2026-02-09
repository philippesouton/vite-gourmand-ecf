<?php

namespace App\Service;

use PDO;
use PDOException;

class Db
{
    private ?PDO $pdo = null;

    public function conn(): PDO
    {
        if ($this->pdo) {
            return $this->pdo;
        }

        $url = $_ENV['DATABASE_URL'] ?? $_SERVER['DATABASE_URL'] ?? getenv('DATABASE_URL');
        if (!$url) {
            throw new \RuntimeException('DATABASE_URL is not set');
        }

        $parts = parse_url($url);
        if ($parts === false) {
            throw new \RuntimeException('Invalid DATABASE_URL');
        }

        $host = $parts['host'] ?? '127.0.0.1';
        $port = $parts['port'] ?? 5432;
        $user = $parts['user'] ?? '';
        $pass = $parts['pass'] ?? '';
        $db = ltrim($parts['path'] ?? '', '/');

        $dsn = sprintf('pgsql:host=%s;port=%s;dbname=%s', $host, $port, $db);


        try {
            $this->pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        } catch (PDOException $e) {
            throw new \RuntimeException('DB connection failed: ' . $e->getMessage());
        }

        return $this->pdo;
    }

    public function fetchAll(string $sql, array $params = []): array
    {
        $stmt = $this->conn()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function fetchOne(string $sql, array $params = []): ?array
    {
        $stmt = $this->conn()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function execute(string $sql, array $params = []): int
    {
        $stmt = $this->conn()->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    public function quote(string $value): string
    {
        return $this->conn()->quote($value);
    }
}
