<?php

namespace Tests\Unit;

use App\Actions\Cash\OpenCashSessionAction;
use Illuminate\Database\QueryException;
use ReflectionClass;
use Tests\TestCase;

class OpenCashSessionActionConcurrencyTest extends TestCase
{
    public function test_cash_open_serializes_concurrent_requests_by_user_row(): void
    {
        $source = file_get_contents(app_path('Actions/Cash/OpenCashSessionAction.php'));

        $this->assertIsString($source);
        $userLockPosition = strpos($source, 'User::query()');
        $sessionCheckPosition = strpos($source, '$alreadyOpen = CashRegisterSession::query()');

        $this->assertNotFalse($userLockPosition);
        $this->assertNotFalse($sessionCheckPosition);
        $this->assertLessThan($sessionCheckPosition, $userLockPosition);
        $this->assertStringContainsString('->lockForUpdate()', $source);
    }

    public function test_cash_open_concurrency_database_codes_are_treated_as_functional_validation(): void
    {
        $action = (new ReflectionClass(OpenCashSessionAction::class))->newInstanceWithoutConstructor();
        $method = new \ReflectionMethod(OpenCashSessionAction::class, 'isOpenSessionConcurrencyViolation');
        $method->setAccessible(true);

        foreach (['1062', '1205', '1213'] as $driverCode) {
            $exception = new QueryException(
                'mysql',
                'insert into cash_register_sessions ...',
                [],
                $this->pdoException('HY000', $driverCode),
            );

            $this->assertTrue($method->invoke($action, $exception), "Driver code {$driverCode} should be controlled.");
        }
    }

    public function test_unrelated_cash_open_database_errors_are_not_swallowed(): void
    {
        $action = (new ReflectionClass(OpenCashSessionAction::class))->newInstanceWithoutConstructor();
        $method = new \ReflectionMethod(OpenCashSessionAction::class, 'isOpenSessionConcurrencyViolation');
        $method->setAccessible(true);

        $exception = new QueryException(
            'mysql',
            'select * from missing_table',
            [],
            $this->pdoException('42S02', '1146'),
        );

        $this->assertFalse($method->invoke($action, $exception));
    }

    private function pdoException(string $sqlState, string $driverCode): \PDOException
    {
        $exception = new \PDOException('simulated database race');
        $exception->errorInfo = [$sqlState, $driverCode, 'simulated database race'];

        return $exception;
    }
}
