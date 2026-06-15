-- seed_servicios_iniciales.sql
-- Este archivo es guía; Codex debe convertirlo a seeders Laravel idempotentes.
INSERT INTO categories (name, slug, active, sort_order, created_at, updated_at) VALUES ('Servicios generales', 'servicios-generales', 1, 0, NOW(), NOW()) ON DUPLICATE KEY UPDATE name=VALUES(name), active=VALUES(active), updated_at=NOW();
INSERT INTO categories (name, slug, active, sort_order, created_at, updated_at) VALUES ('Laboratorio', 'laboratorio', 1, 0, NOW(), NOW()) ON DUPLICATE KEY UPDATE name=VALUES(name), active=VALUES(active), updated_at=NOW();
INSERT INTO categories (name, slug, active, sort_order, created_at, updated_at) VALUES ('Medicamentos', 'medicamentos', 1, 0, NOW(), NOW()) ON DUPLICATE KEY UPDATE name=VALUES(name), active=VALUES(active), updated_at=NOW();
INSERT INTO categories (name, slug, active, sort_order, created_at, updated_at) VALUES ('Odontología', 'odontolog-a', 1, 0, NOW(), NOW()) ON DUPLICATE KEY UPDATE name=VALUES(name), active=VALUES(active), updated_at=NOW();
INSERT INTO categories (name, slug, active, sort_order, created_at, updated_at) VALUES ('Radiología', 'radiolog-a', 1, 0, NOW(), NOW()) ON DUPLICATE KEY UPDATE name=VALUES(name), active=VALUES(active), updated_at=NOW();
-- Servicios omitidos aquí en SQL plano para evitar duplicación larga; usar catalogo_servicios_inicial.csv como fuente del seeder.
