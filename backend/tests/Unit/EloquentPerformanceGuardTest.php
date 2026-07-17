<?php

namespace Tests\Unit;

use Illuminate\Database\Eloquent\Model;
use Tests\TestCase;

class EloquentPerformanceGuardTest extends TestCase
{
    public function test_lazy_loading_is_blocked_outside_production(): void
    {
        $this->assertFalse(app()->isProduction());
        $this->assertTrue(
            Model::preventsLazyLoading(),
            'Development and test must fail on accidental lazy loading so N+1 queries are caught before production.',
        );
    }
}
