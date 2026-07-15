# Inspección visual de progreso — login

Fecha: 15 de julio de 2026.  
Viewport: 1366×768.  
Captura: [`login-network-state-1366x768.png`](login-network-state-1366x768.png).

La captura real del worktree confirma una composición estable, wordmark
provisional explícito, campos y acción principal visibles sin scroll, y un
espacio de estado que no desplaza el formulario. La captura muestra el estado
informativo inicial; la severidad neutral durante `Validando credenciales` y el
bloqueo de doble envío están cubiertos por prueba de componente porque el login
real completa demasiado rápido para obtener una captura determinista de ese
instante.

Dashboard se observó en navegador mientras `setup-status` seguía verificándose:
el ledger, la próxima acción y facturas recientes permanecieron montados. La
captura de esa observación presentó artefactos negros del rasterizador headless
y no se conserva como evidencia visual canónica; el comportamiento queda
respaldado por la prueba focalizada de error parcial.
