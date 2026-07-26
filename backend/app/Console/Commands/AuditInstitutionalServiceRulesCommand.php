<?php

namespace App\Console\Commands;

use App\Actions\Catalog\AuditInstitutionalServiceRulesAction;
use Illuminate\Console\Command;

class AuditInstitutionalServiceRulesCommand extends Command
{
    protected $signature = 'hospital:audit-catalog-rules';

    protected $description = 'Verifica que solo la eritropoyetina institucional tenga la regla protegida.';

    public function handle(AuditInstitutionalServiceRulesAction $audit): int
    {
        if ($audit->execute()['valid']) {
            $this->info('Regla institucional de eritropoyetina valida.');

            return self::SUCCESS;
        }

        $this->error('Catalogo institucional invalido. Revise la regla de eritropoyetina antes de facturar.');

        return self::FAILURE;
    }
}
