# Evidencia de aceptacion LAN

Copiar como `qa/LAN_CLIENT_VALIDATION_PROOF.md` y completar desde una segunda
computadora fisica conectada a la red hospitalaria.

- Fecha/hora y zona: TODO
- Responsable: TODO
- Servidor/IP fija: TODO
- Cliente, sistema operativo y navegador: TODO
- Usuario/rol: TODO
- Evidencia fotografica/capturas: TODO

## Comprobaciones

- [ ] `scripts/validate_lan_client.ps1 -BaseUrl http://IP_SERVIDOR` pasa.
- [ ] `/up`, `/login`, assets JS/CSS y sesion funcionan sin internet.
- [ ] Login no produce 401/419 inesperado.
- [ ] Abrir caja, crear factura con paciente y cobrar funciona.
- [ ] Recibo abre, imprime y se reimprime desde historial.
- [ ] Reportes cargan y reflejan el cobro.
- [ ] Un cajero no ve administracion; un admin si.
- [ ] Backup manual cambia de `pending` a `success`.
- [ ] Reinicio controlado del cliente no pierde la operacion confirmada.

Conclusion y firma: TODO
