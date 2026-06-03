<?php

namespace App\Http\Controllers;

use App\Http\Requests\Catalog\IndexCategoryRequest;
use App\Http\Requests\Catalog\StoreCategoryRequest;
use App\Http\Requests\Catalog\UpdateCategoryRequest;
use App\Models\AuditLog;
use App\Models\Category;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function index(IndexCategoryRequest $request): JsonResponse
    {
        $categories = Category::query()
            ->when($request->has('active'), fn ($query) => $query->where('active', $request->boolean('active')))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $categories,
        ]);
    }

    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $category = DB::transaction(function () use ($request): Category {
            $category = Category::query()->create([
                ...$request->validated(),
                'slug' => Str::slug($request->string('name')),
                'active' => $request->boolean('active', true),
                'sort_order' => (int) $request->input('sort_order', 0),
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
            ]);

            $this->audit($request, 'category.created', $category, null);

            return $category;
        });

        return response()->json([
            'data' => $category,
        ], 201);
    }

    public function update(UpdateCategoryRequest $request, Category $category): JsonResponse
    {
        $category = DB::transaction(function () use ($request, $category): Category {
            $oldValues = $this->auditPayload($category);
            $data = $request->validated();

            if (array_key_exists('name', $data)) {
                $data['slug'] = Str::slug($data['name']);
            }

            $category->fill([
                ...$data,
                'updated_by' => $request->user()->id,
            ])->save();

            $this->audit($request, 'category.updated', $category->refresh(), $oldValues);

            return $category->refresh();
        });

        return response()->json([
            'data' => $category->refresh(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function auditPayload(Category $category): array
    {
        return $category->only(['name', 'slug', 'active', 'sort_order']);
    }

    /**
     * @param  array<string, mixed>|null  $oldValues
     */
    private function audit(FormRequest $request, string $action, Category $category, ?array $oldValues): void
    {
        AuditLog::query()->create([
            'user_id' => $request->user()->id,
            'action' => $action,
            'entity_type' => Category::class,
            'entity_id' => $category->id,
            'old_values' => $oldValues,
            'new_values' => $this->auditPayload($category),
        ]);
    }
}
