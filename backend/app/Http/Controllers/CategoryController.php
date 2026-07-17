<?php

namespace App\Http\Controllers;

use App\Http\Requests\Catalog\IndexCategoryRequest;
use App\Http\Requests\Catalog\StoreCategoryRequest;
use App\Http\Requests\Catalog\UpdateCategoryRequest;
use App\Models\Category;
use App\Models\User;
use App\Support\AuditLogger;
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
        $user = $this->authenticatedUser($request);

        $category = DB::transaction(function () use ($request, $user): Category {
            $category = Category::query()->create([
                ...$request->validated(),
                'slug' => Str::slug($request->string('name')->toString()),
                'active' => $request->boolean('active', true),
                'sort_order' => $request->integer('sort_order', 0),
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ]);

            $this->audit($request, $user, 'category.created', $category, null);

            return $category;
        });

        return response()->json([
            'data' => $category,
        ], 201);
    }

    public function update(UpdateCategoryRequest $request, Category $category): JsonResponse
    {
        $user = $this->authenticatedUser($request);

        $category = DB::transaction(function () use ($request, $category, $user): Category {
            $oldValues = $this->auditPayload($category);
            $data = $request->validated();

            if (array_key_exists('name', $data)) {
                $data['slug'] = Str::slug($request->string('name')->toString());
            }

            $category->fill([
                ...$data,
                'updated_by' => $user->id,
            ])->save();

            $this->audit($request, $user, 'category.updated', $category->refresh(), $oldValues);

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
    private function audit(FormRequest $request, User $user, string $action, Category $category, ?array $oldValues): void
    {
        app(AuditLogger::class)->log(
            action: $action,
            entity: $category,
            user: $user,
            request: $request,
            oldValues: $oldValues,
            newValues: $this->auditPayload($category),
        );
    }
}
