<?php

namespace Tests\Unit;

use Tests\TestCase;

/**
 * Documents the project's authorization strategy.
 *
 * Prior to v1.0.0 the audit (docs/AUDIT_2026_06_02.md) flagged the
 * absence of `app/Policies/` as a violation of AGENTS.md
 * ("Policies/Gates para permisos"). The reason the directory did
 * not exist was that the same checks were duplicated in
 * `FormRequest::authorize()` and runtime guards in the Actions.
 *
 * v1.0.0 keeps the existing checks (they are correct) and adds
 * dedicated `InvoicePolicy` and `CashSessionPolicy` classes so
 * the Gate facade can resolve them. The two checks below lock the
 * invariant: when the directory exists, the provider must wire
 * the policy mappings, and vice versa.
 */
class AuthorizationStrategyTest extends TestCase
{
    public function test_policies_directory_has_invoice_and_cash_session_policies(): void
    {
        $policiesPath = app_path('Policies');

        $this->assertDirectoryExists($policiesPath);
        $this->assertFileExists($policiesPath.'/InvoicePolicy.php');
        $this->assertFileExists($policiesPath.'/CashSessionPolicy.php');
        $this->assertFileDoesNotExist(
            $policiesPath.'/CashRegisterSessionPolicy.php',
            'CashRegisterSession must use the registered CashSessionPolicy only; a second policy class creates divergent RBAC rules.',
        );
    }

    public function test_app_service_provider_registers_gate_policy_mappings(): void
    {
        $providerPath = app_path('Providers/AppServiceProvider.php');

        $this->assertFileExists($providerPath);

        $contents = (string) file_get_contents($providerPath);

        $this->assertStringContainsString(
            'Gate::policy(',
            $contents,
            'AppServiceProvider must register Gate::policy mappings so the policies in app/Policies/ are wired.',
        );
        $this->assertStringContainsString('Invoice::class, InvoicePolicy::class', $contents);
        $this->assertStringContainsString('CashRegisterSession::class, CashSessionPolicy::class', $contents);
    }
}
