# Integridad del paquete offline: checksums vs firma

- **Estado:** documento operativo y de limites.
- **Fecha de revision:** 2026-09-17.
- **Alcance:** paquete offline (`offline-release/`), imagenes `.tar`, instalador
  Windows y verificacion de hashes.

## 1. Regla central

**Un hash en el mismo medio no es una firma.** SHA-256 demuestra que el archivo
no cambio *respecto del manifiesto que se esta usando*, pero si el atacante
puede alterar el `.tar` y el `checksums.sha256` en la misma USB, el par sigue
siendo coherente. La integridad detecta corrupcion, copia incompleta o
alteracion accidental; **no** demuestra procedencia ni autorizacion.

| Propiedad | Que responde | Como se cubre hoy |
| --- | --- | --- |
| Integridad | El archivo cambio respecto al manifiesto? | SHA-256 en `checksums.sha256` + sidecar `<tar>.sha256` |
| Consistencia interna | El paquete esta completo y coherente? | `assert_offline_release_clean.ps1` |
| Autenticidad / procedencia | Quien produjo el paquete? | **NO cubierto**: no hay firma criptografica ni canal externo de confianza |
| Autorizacion de entrega | La institucion aprobo este artefacto? | Proceso institucional, separado de este repositorio |

## 2. Que verifica el sistema (implementado)

### Imagenes Docker antes de cargar

`scripts/load_offline_images.ps1`:

1. Exige que exista `offline-images/` y al menos un `.tar`.
2. Exige el manifiesto `checksums.sha256`; si falta, **falla cerrado**.
3. Para cada `.tar`, exige el sidecar `<imagen>.tar.sha256`; si falta, es
   invalido o no coincide, **falla cerrado** y no ejecuta `docker load`.
4. Exige que el `.tar` aparezca en `checksums.sha256` con el mismo hash.
5. Solo si **todos** los archivos pasan, ejecuta `docker load` y luego valida
   que las imagenes requeridas existan en el registro local.

Ninguna imagen se carga si un solo archivo no verifica. El script declara en su
salida que la verificacion detecta alteracion del paquete y no sustituye una
firma de origen confiable.

### Paquete de release

- `scripts/make_offline_release.ps1` genera `checksums.sha256`, los sidecars
  `*.tar.sha256` y `MANIFEST.txt` con rama, commit y tamanos.
- `scripts/assert_offline_release_clean.ps1` re-valida el paquete: archivos
  obligatorios, rutas, hashes contra `checksums.sha256` y las imagenes
  runtime fijadas por digest (`nginx@sha256:...`, `mariadb@sha256:...`,
  `quay.io/soketi/soketi@sha256:...`).
- Los digests de imagenes base quedan **anclados en el compose y en el builder**,
  de modo que un tag reetiquetado no cambie el contenido sin cambiar el digest.

### Instalador Windows

- `scripts/build_windows_installer.ps1` escribe `S_Hospital-Instalador.exe.sha256`.
- `scripts/certification/promote_to_usb.ps1` compara el SHA-256 del `.exe`, el
  `.sha256` y `installer_sha256` del manifiesto antes de promover.
- `docs/GENERAR_INSTALADOR_WINDOWS.md` indica al operador comparar
  `Get-FileHash` con el `.sha256` y **no instalar** si no coinciden.

## 3. Que NO esta cubierto (declarado)

- **No hay firma de codigo Authenticode.** El `.exe` funciona sin firma, pero
  Windows puede mostrar "Editor desconocido". No se usa `signtool` ni
  `Get-AuthenticodeSignature` en el pipeline.
- **No hay firma del paquete de imagenes** (GPG/minisign/Sigstore).
- **No hay hash de confianza por canal separado.** El hash viaja en la misma
  USB que el contenido, por lo que no prueba procedencia.
- **No hay certificado de firma emitido a nombre de la institucion.**

## 4. Recomendaciones institucionales (decision externa)

1. Emitir o adquirir un certificado de firma de codigo a nombre del hospital y
   firmar `S_Hospital-Instalador.exe`; esto habilita la verificacion de
   procedencia en Windows y reduce la friccion de SmartScreen.
2. Publicar el SHA-256 del artefacto aprobado por un canal distinto de la USB
   (correo institucional firmado, intranet, acta de entrega) para convertirlo en
   referencia de confianza.
3. Registrar en el acta de entrega: version, commit, hashes y responsable.
   El manifiesto de candidato (`scripts/certification/`) ya expone
   `certification_status` e `installer_sha256`; usarlo como fuente.

## 5. Comandos de verificacion

```powershell
# Paquete de imagenes
Get-FileHash .\offline-images\backend.tar -Algorithm SHA256
Get-Content .\offline-images\backend.tar.sha256
Get-Content .\checksums.sha256

# Instalador Windows
Get-FileHash .\S_Hospital-Instalador.exe -Algorithm SHA256
Get-Content .\S_Hospital-Instalador.exe.sha256

# Validacion del paquete completo (dev/build)
powershell -File scripts\assert_offline_release_clean.ps1
```

## 6. Evidencia asociada

- `scripts/load_offline_images.test.ps1`: caso de tar alterado, manifiesto
  ausente y sidecar ausente; confirma que no se ejecuta `docker load`.
- `scripts/offline_release_contract.test.ps1`: contrato del paquete/validador.
- `hospital-ai/evidencia/M-W1-INST-01/`: resultados de esta revision.
