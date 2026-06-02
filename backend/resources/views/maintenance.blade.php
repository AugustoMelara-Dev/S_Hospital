<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sistema de Caja Hospitalaria - En mantenimiento</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #f5f5f7;
            color: #1d1d1f;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 2rem;
        }
        main {
            max-width: 480px;
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,.05), 0 4px 24px rgba(0,0,0,.06);
            padding: 2.5rem 2rem;
            text-align: center;
        }
        h1 {
            font-size: 1.5rem;
            font-weight: 600;
            margin: 0 0 0.75rem;
        }
        p {
            font-size: 1rem;
            line-height: 1.5;
            margin: 0 0 1rem;
            color: #515154;
        }
        .retry {
            font-size: 0.875rem;
            color: #86868b;
        }
    </style>
</head>
<body>
    <main role="main" aria-labelledby="maintenance-title">
        <h1 id="maintenance-title">Sistema en mantenimiento</h1>
        <p>{{ $message ?? 'El sistema está en mantenimiento. Vuelva a intentarlo en unos minutos.' }}</p>
        <p class="retry">Si necesita atención inmediata, contacte al supervisor del hospital.</p>
    </main>
</body>
</html>
