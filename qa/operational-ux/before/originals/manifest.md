# Capturas originales canónicas

Fuente: capturas entregadas por el usuario en `C:\Users\melar\OneDrive\Pictures\Screenshots`.
Preservadas sin transformación el 15 de julio de 2026. Los hashes SHA-256
permiten comprobar que el baseline no fue sobrescrito.

| # | Archivo preservado | Captura fuente | Tamaño | SHA-256 | Defecto reproducido |
|---|---|---|---:|---|---|
| 1 | `01-login.png` | `221001` | 1917×1021 | `b3356ba58586bcbce81f2b375e0321705374d3d7b4f78d57c314cbf926fabe26` | “Validando credenciales” aparece como error rojo antes de existir un fallo. |
| 2 | `02-dashboard.png` | `221020` | 1917×1027 | `b173375e65697b58ec4b8aef1b209010409adecb8a21da084b9de2f56078ecb4` | Un timeout de configuración reemplaza toda la tarea disponible y expone detalle técnico. |
| 3 | `03-billing-empty.png` | `221104` | 1917×1027 | `ac1056deaeca3c54766831bcfa9e8943fb8579842cb939701bd54f17c842ff9c` | Paciente, búsqueda y cuenta compiten en bloques altos; el primer resultado queda fuera del viewport. |
| 4 | `04-billing-results.png` | `221109` | 1917×1027 | `5c384840e3aba885cde71baa4e345fe4dfb6ea290bc20a790e92c5cf4f8ff6a2` | Resultados repiten “Agregar”, la cuenta vacía ocupa demasiado y existe scroll anidado en categorías. |
| 5 | `05-billing-cart-overlap.png` | `221126` | 672×921 | `80c777279656985980df3f16d71067a4242ec2c2f7b8ee299b75a7f3657eb216` | Resumen, cantidades y alerta se superponen; la acción primaria no es alcanzable. |
| 6 | `06-cashbox-summary.png` | `221249` | 1917×1032 | `18d642b47048c10b039d82a5122f3930232aaf3adb3618bbbbc8577e630e6bd8` | Resumen repite estado y conciliación, consume el primer viewport y muestra una alerta verde redundante. |
| 7 | `07-cashbox-movements.png` | `221256` | 1917×1027 | `a1a0bbb4f9ee39f09b40531f91afa6b0575746eb1daf0ccf22889ce1046e3084` | Grid con scroll interno, truncado destructivo y controles de paginación en inglés. |
| 8 | `08-cashbox-close.png` | `221302` | 1917×1028 | `8cdf6ba7b5686c343a1ccdcd9a86e9b3b149a7cc9eb3a8c5aa0a7216abf4ea90` | Bloqueo ocupa una alerta grande y el cierre se mezcla con métricas antes de la tarea. |
| 9 | `09-history.png` | `221309` | 1917×1026 | `4ad8cb1940658891a0a89f713a1868903dc28c82483dc0c7a93a92dd22239e0b` | Dos registros generan un lienzo vacío enorme, truncado y doble paginación. |
| 10 | `10-catalog-intro.png` | `221316` | 1917×1033 | `6f10eec1c0e588e37e619caee622a0c10ee571383e5fc019a4bbf47548037608` | Métricas y categorías duplicadas desplazan filtros y servicios fuera del primer viewport. |
| 11 | `11-catalog-grid.png` | `221320` | 1917×1027 | `9d913c3cb809d96f378aebf3fbb64d5e18f38ceb1b8e2c82b4da4a22e13cbd7a` | Tabla encajonada con scroll interno, etiquetas repetidas y paginación separada. |
| 12 | `12-settings.png` | `221408` | 1917×1018 | `d9e1043a419dd6a65795e39876de0a8ea9f4e2c068eb3eda0452b242151349e5` | Título duplicado, borde accidental y resúmenes fiscales sobredimensionados. |

La columna “captura fuente” usa el sufijo horario del nombre original. Las
comparaciones equivalentes se documentan en `qa/operational-ux/final-comparison.md`.
