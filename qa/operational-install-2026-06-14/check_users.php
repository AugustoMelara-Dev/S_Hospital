<?php
// Operational test script - read only, no modifications
use App\Models\User;

$users = User::with('roles', 'permissions')->get();
foreach ($users as $user) {
    echo "---" . PHP_EOL;
    echo "ID: {$user->id}" . PHP_EOL;
    echo "Name: {$user->name}" . PHP_EOL;
    echo "Username: {$user->username}" . PHP_EOL;
    echo "Active: " . ($user->active ? 'YES' : 'NO') . PHP_EOL;
    echo "Roles: " . $user->getRoleNames()->join(', ') . PHP_EOL;
    echo "Permissions: " . $user->getAllPermissions()->pluck('name')->join(', ') . PHP_EOL;
}
