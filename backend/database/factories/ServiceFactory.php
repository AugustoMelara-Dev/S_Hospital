<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Service;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Service>
 */
class ServiceFactory extends Factory
{
    protected $model = Service::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->words(2, true),
            'slug' => $this->faker->unique()->slug(2),
            'price' => $this->faker->randomFloat(2, 1, 500),
            'taxable' => true,
            'active' => true,
            'visible_in_billing' => true,
            'is_billable' => true,
            'scan_code' => $this->faker->unique()->numerify('###-###-####'),
            'barcode' => $this->faker->unique()->ean13(),
            'qr_code' => $this->faker->unique()->uuid(),
            'special_rule_code' => null,
            'category_id' => null,
            'area_id' => null,
        ];
    }
}
