<?php

namespace App\Http\Middleware;

use App\Models\IdempotencyKey as IdempotencyKeyModel;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resilience audit finding R-01: required `Idempotency-Key` header that
 * turns retried POSTs into deterministic replays for cash-critical
 * routes. The cashier's browser may drop the response after the server
 * commits; a plain browser retry would otherwise create a duplicate
 * payment. With the key, the duplicate request is short-circuited and
 * the original response is replayed byte-for-byte.
 *
 * Behavior:
 *   - Header missing -> request is rejected with 428 before any mutation.
 *   - Header present, first hit → insert a row, run the request, store
 *     status + body keyed by (user_id, route_signature, key). Subsequent
 *     hits with the same fingerprint replay the stored response.
 *   - Header present, key already used with a different payload → 422.
 *   - Header present, key is currently in flight (no completed_at) → 409.
 *
 * Only attaches to authenticated POST routes. GET, DELETE, PATCH and
 * OPTIONS are unaffected.
 */
class IdempotencyKey
{
    private const MAX_KEY_LENGTH = 191;

    private const IN_FLIGHT_TTL_SECONDS = 120;

    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->isMethod('POST')) {
            return $next($request);
        }

        $key = $this->extractKey($request);
        if ($key === null) {
            return new JsonResponse([
                'message' => 'Esta operacion requiere Idempotency-Key para evitar duplicados.',
                'errors' => [
                    'idempotency_key' => ['Incluya una clave unica por intento de operacion.'],
                ],
            ], 428);
        }

        $userId = $request->user()?->id;
        if ($userId === null) {
            return $next($request);
        }

        $routeSignature = $this->routeSignature($request);
        $fingerprint = $this->fingerprint($request);

        $existing = IdempotencyKeyModel::query()
            ->where('user_id', $userId)
            ->where('route_signature', $routeSignature)
            ->where('idempotency_key', $key)
            ->first();

        if ($existing !== null) {
            if ($existing->request_fingerprint !== $fingerprint) {
                return new JsonResponse([
                    'message' => 'La clave de idempotencia ya fue utilizada con un cuerpo de solicitud distinto.',
                    'errors' => [
                        'idempotency_key' => ['Reutilice la misma carga o genere una nueva clave.'],
                    ],
                ], $this->payloadMismatchStatus($request));
            }

            if ($existing->completed_at === null) {
                $age = $existing->created_at?->diffInSeconds(now()) ?? 0;
                if ($age < self::IN_FLIGHT_TTL_SECONDS) {
                    return new JsonResponse([
                        'message' => 'Una solicitud previa con esta clave de idempotencia sigue en curso.',
                    ], 409);
                }

                return $this->staleIncompleteResponse();
            }

            return $this->replayResponse($existing);
        }

        try {
            $reservation = IdempotencyKeyModel::query()->create([
                'user_id' => $userId,
                'route_signature' => $routeSignature,
                'idempotency_key' => $key,
                'request_fingerprint' => $fingerprint,
                'completed_at' => null,
            ]);
        } catch (QueryException $exception) {
            // Race: another worker inserted the same key in parallel. The
            // duplicate handler below will replay the canonical response
            // once that worker completes.
            $existing = IdempotencyKeyModel::query()
                ->where('user_id', $userId)
                ->where('route_signature', $routeSignature)
                ->where('idempotency_key', $key)
                ->first();
            if ($existing === null) {
                throw $exception;
            }

            return $existing->completed_at === null
                ? new JsonResponse(['message' => 'Una solicitud previa con esta clave de idempotencia sigue en curso.'], 409)
                : $this->replayResponse($existing);
        }

        try {
            $response = $next($request);
        } catch (\Throwable $exception) {
            $reservation->delete();

            throw $exception;
        }

        // Only successful (2xx) responses are replayable. If the server
        // refused the request (4xx) or crashed (5xx) we drop the
        // reservation so the cashier can retry with a fix (e.g., a
        // corrected amount after enabling partial payments). This is the
        // safe default: a failed payment MUST be retryable; a
        // successful payment MUST be replayed.
        if ($response->getStatusCode() < 200 || $response->getStatusCode() >= 300) {
            $reservation->delete();

            return $response;
        }

        $this->persistResponse($reservation, $response);

        return $response;
    }

    private function payloadMismatchStatus(Request $request): int
    {
        return $request->is('api/invoices') ? 409 : 422;
    }

    private function extractKey(Request $request): ?string
    {
        $raw = $request->header('Idempotency-Key');
        if (! is_string($raw) || $raw === '') {
            $bodyKey = $request->input('idempotency_key');
            $raw = is_string($bodyKey) ? $bodyKey : null;
        }

        if ($raw === null) {
            return null;
        }

        $trimmed = trim($raw);
        if ($trimmed === '' || strlen($trimmed) > self::MAX_KEY_LENGTH) {
            return null;
        }

        return $trimmed;
    }

    private function routeSignature(Request $request): string
    {
        $method = strtoupper($request->getMethod());

        return $method.' '.$request->path();
    }

    private function fingerprint(Request $request): string
    {
        $body = (string) $request->getContent();
        $method = $request->getMethod();
        $route = $this->routeSignature($request);

        return hash('sha256', $method.'|'.$route.'|'.$body);
    }

    private function replayResponse(IdempotencyKeyModel $reservation): Response
    {
        $plain = $reservation->response_body_plain;
        $status = (int) ($reservation->response_status ?? 200);

        if ($plain === null || $reservation->response_status === null) {
            return $this->staleIncompleteResponse();
        }

        if (str_starts_with($plain, '%PDF')) {
            return new Response($plain, $status, [
                'Content-Type' => 'application/pdf',
                'Idempotent-Replay' => 'true',
            ]);
        }

        $payload = json_decode($plain, true);
        if (! is_array($payload)) {
            $payload = ['data' => null];
        }

        return new JsonResponse($payload, $status, [
            'Idempotent-Replay' => 'true',
        ]);
    }

    private function staleIncompleteResponse(): JsonResponse
    {
        return new JsonResponse([
            'message' => 'La operacion anterior no completo una respuesta replayable.',
            'errors' => [
                'idempotency_key' => ['La operacion anterior no completo una respuesta replayable. Verifique el estado de la factura antes de reintentar.'],
            ],
        ], 409);
    }

    private function persistResponse(IdempotencyKeyModel $reservation, Response $response): void
    {
        $body = $response->getContent();
        $plain = is_string($body) ? $body : null;

        // Use the encrypted accessor so the underlying column stores
        // `Crypt::encryptString()` output, never raw JSON with PII.
        $reservation->response_body_plain = $plain;
        $reservation->forceFill([
            'response_status' => $response->getStatusCode(),
            'completed_at' => now(),
        ])->save();
    }
}
