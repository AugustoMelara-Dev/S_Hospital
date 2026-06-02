<?php

namespace Tests\Unit;

use Tests\TestCase;

class AuthorizationStrategyTest extends TestCase
{
    public function test_policies_directory_is_removed_in_favor_of_form_request_authz(): void
    {
        $policiesPath = app_path('Policies');

        $this->assertDirectoryDoesNotExist(
            $policiesPath,
            'app/Policies was removed because the project uses Form Request authorize() + permission string checks (e.g. $user->can("invoices.view")) as the single source of authorization. Re-introducing the directory without also wiring Gate::policy() registrations would leave the policies dead.'
        );
    }

    public function test_app_service_provider_does_not_register_specific_policies(): void
    {
        $providerPath = app_path('Providers/AppServiceProvider.php');

        $this->assertFileExists($providerPath);

        $contents = file_get_contents($providerPath);

        $this->assertStringNotContainsString(
            'Gate::policy(',
            (string) $contents,
            'AppServiceProvider must not register Gate::policy mappings while the app/Policies directory is empty. If you re-add policies, register them here too.'
        );
    }
}
