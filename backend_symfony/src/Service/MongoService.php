<?php

namespace App\Service;

class MongoService
{
    private ?\MongoDB\Driver\Manager $manager = null;
    private string $dbName;

    public function __construct()
    {
        $this->dbName = $_ENV['MONGO_DB'] ?? $_SERVER['MONGO_DB'] ?? getenv('MONGO_DB') ?: 'vite_gourmand_clean';
        $url = $_ENV['MONGO_URL'] ?? $_SERVER['MONGO_URL'] ?? getenv('MONGO_URL') ?: '';

        if ($url && class_exists('MongoDB\\Driver\\Manager')) {
            try {
                $this->manager = new \MongoDB\Driver\Manager($url);
            } catch (\Throwable $e) {
                $this->manager = null;
            }
        }
    }

    public function isAvailable(): bool
    {
        return $this->manager !== null;
    }

    public function insertOrder(array $doc): void
    {
        if (!$this->manager) {
            return;
        }
        try {
            $bulk = new \MongoDB\Driver\BulkWrite();
            $bulk->insert($doc);
            $this->manager->executeBulkWrite($this->dbName . '.orders', $bulk);
        } catch (\Throwable $e) {
            // silent fail
        }
    }

    public function statsMenus(?string $menuId, ?string $from, ?string $to): ?array
    {
        if (!$this->manager) {
            return null;
        }

        $match = [];
        if ($menuId) {
            $match['menuId'] = (int)$menuId;
        }
        if ($from || $to) {
            $created = [];
            if ($from) $created['$gte'] = $from;
            if ($to) $created['$lte'] = $to;
            $match['createdAt'] = $created;
        }

        $pipeline = [];
        if ($match) {
            $pipeline[] = ['$match' => $match];
        }
        $pipeline[] = [
            '$group' => [
                '_id' => '$menuId',
                'count' => ['$sum' => 1],
                'total' => ['$sum' => '$total']
            ]
        ];

        $command = new \MongoDB\Driver\Command([
            'aggregate' => 'orders',
            'pipeline' => $pipeline,
            'cursor' => new \stdClass()
        ]);

        try {
            $cursor = $this->manager->executeCommand($this->dbName, $command);
            $rows = [];
            foreach ($cursor as $doc) {
                $rows[] = [
                    'menuId' => $doc->_id,
                    'count' => $doc->count,
                    'total' => $doc->total
                ];
            }
            return $rows;
        } catch (\Throwable $e) {
            return null;
        }
    }
}
