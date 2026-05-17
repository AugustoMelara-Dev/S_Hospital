# Referencia: despliegue offline en red local

## Topología
PC servidor:
- Laravel API
- Frontend compilado o servido por Nginx/Apache
- MySQL/MariaDB
- Backups locales

Clientes:
- Navegador web
- Acceso por IP local: http://192.168.1.10

## Requisitos
- Router o switch local.
- IP fija para servidor.
- Firewall permitiendo puerto HTTP/HTTPS local.
- Impresora térmica instalada en la PC que imprimirá o compartida según soporte.

## Backups
- Backup automático diario.
- Backup manual desde admin.
- Restauración documentada.
- Copia externa USB recomendada.

## Riesgos
- Si el servidor se apaga, nadie factura.
- Cortes eléctricos pueden corromper datos si no hay UPS.
- IP dinámica rompe acceso de clientes.
