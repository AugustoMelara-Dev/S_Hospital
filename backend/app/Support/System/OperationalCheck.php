<?php

namespace App\Support\System;

class OperationalCheck
{
    public function __construct(
        public readonly string $code,
        public readonly string $label,
        public readonly string $status,
        public readonly string $detail,
    ) {}

    /**
     * @return array{code: string, label: string, status: string, detail: string}
     */
    public function toArray(): array
    {
        return [
            'code' => $this->code,
            'label' => $this->label,
            'status' => $this->status,
            'detail' => $this->detail,
        ];
    }
}
