-- ============================================================
-- HealthTech Solutions — Seed: Roles del sistema y permisos
-- Roles de sistema (ES_SISTEMA=1): no modificables desde UI
-- Compatible: Oracle 19c y Oracle 21c XE
-- ============================================================

-- ---- Roles ----
MERGE INTO SEC_ROLES r
USING (
  SELECT 'SUPER_ADMIN'    AS CODIGO, 'Super Administrador'     AS NOMBRE, 1 AS NIVEL FROM DUAL UNION ALL
  SELECT 'ADMIN_HOSPITAL','Administrador de Hospital',                         2 FROM DUAL UNION ALL
  SELECT 'MEDICO',        'Médico',                                            3 FROM DUAL UNION ALL
  SELECT 'ENFERMERO',     'Enfermero/a',                                       3 FROM DUAL UNION ALL
  SELECT 'FARMACEUTICO',  'Farmacéutico',                                      4 FROM DUAL UNION ALL
  SELECT 'LABORATORISTA', 'Laboratorista',                                     4 FROM DUAL UNION ALL
  SELECT 'BODEGUERO',     'Bodeguero',                                         4 FROM DUAL UNION ALL
  SELECT 'ADMINISTRATIVO','Administrativo',                                    4 FROM DUAL UNION ALL
  SELECT 'AUDITOR',       'Auditor',                                           4 FROM DUAL UNION ALL
  SELECT 'PROVEEDOR',     'Proveedor',                                         5 FROM DUAL
) src ON (r.CODIGO = src.CODIGO)
WHEN NOT MATCHED THEN
  INSERT (CODIGO, NOMBRE, NIVEL, ES_SISTEMA, ACTIVO)
  VALUES (src.CODIGO, src.NOMBRE, src.NIVEL, 1, 1);

-- ---- Permisos por módulo ----
MERGE INTO SEC_PERMISOS p
USING (
  -- Seguridad
  SELECT 'security' AS MODULO, 'view'   AS ACCION, 'security.view'           AS CODIGO FROM DUAL UNION ALL
  SELECT 'security', 'create',  'security.create'           FROM DUAL UNION ALL
  SELECT 'security', 'edit',    'security.edit'             FROM DUAL UNION ALL
  SELECT 'security', 'audit',   'security.audit'            FROM DUAL UNION ALL
  -- Pacientes
  SELECT 'patients', 'view',    'patients.view'             FROM DUAL UNION ALL
  SELECT 'patients', 'create',  'patients.create'           FROM DUAL UNION ALL
  SELECT 'patients', 'edit',    'patients.edit'             FROM DUAL UNION ALL
  SELECT 'patients', 'export',  'patients.export'           FROM DUAL UNION ALL
  -- Citas
  SELECT 'appointments', 'view',   'appointments.view'      FROM DUAL UNION ALL
  SELECT 'appointments', 'create', 'appointments.create'    FROM DUAL UNION ALL
  SELECT 'appointments', 'edit',   'appointments.edit'      FROM DUAL UNION ALL
  SELECT 'appointments', 'delete', 'appointments.delete'    FROM DUAL UNION ALL
  -- Emergencias
  SELECT 'emergency', 'view',   'emergency.view'            FROM DUAL UNION ALL
  SELECT 'emergency', 'create', 'emergency.create'          FROM DUAL UNION ALL
  SELECT 'emergency', 'edit',   'emergency.edit'            FROM DUAL UNION ALL
  -- Hospitalización
  SELECT 'hospitalization', 'view',   'hospitalization.view'   FROM DUAL UNION ALL
  SELECT 'hospitalization', 'create', 'hospitalization.create' FROM DUAL UNION ALL
  SELECT 'hospitalization', 'edit',   'hospitalization.edit'   FROM DUAL UNION ALL
  -- Cirugía
  SELECT 'surgery', 'view',    'surgery.view'               FROM DUAL UNION ALL
  SELECT 'surgery', 'create',  'surgery.create'             FROM DUAL UNION ALL
  SELECT 'surgery', 'approve', 'surgery.approve'            FROM DUAL UNION ALL
  -- Laboratorio
  SELECT 'laboratory', 'view',   'laboratory.view'          FROM DUAL UNION ALL
  SELECT 'laboratory', 'create', 'laboratory.create'        FROM DUAL UNION ALL
  SELECT 'laboratory', 'edit',   'laboratory.edit'          FROM DUAL UNION ALL
  -- Farmacia
  SELECT 'pharmacy', 'view',     'pharmacy.view'            FROM DUAL UNION ALL
  SELECT 'pharmacy', 'dispense', 'pharmacy.dispense'        FROM DUAL UNION ALL
  SELECT 'pharmacy', 'create',   'pharmacy.create'          FROM DUAL UNION ALL
  -- Bodega
  SELECT 'warehouse', 'view',   'warehouse.view'            FROM DUAL UNION ALL
  SELECT 'warehouse', 'create', 'warehouse.create'          FROM DUAL UNION ALL
  SELECT 'warehouse', 'edit',   'warehouse.edit'            FROM DUAL UNION ALL
  SELECT 'warehouse', 'approve','warehouse.approve'         FROM DUAL UNION ALL
  -- Enfermería
  SELECT 'nursing', 'view',   'nursing.view'                FROM DUAL UNION ALL
  SELECT 'nursing', 'create', 'nursing.create'              FROM DUAL UNION ALL
  SELECT 'nursing', 'edit',   'nursing.edit'                FROM DUAL
) src ON (p.CODIGO = src.CODIGO)
WHEN NOT MATCHED THEN
  INSERT (MODULO, ACCION, CODIGO)
  VALUES (src.MODULO, src.ACCION, src.CODIGO);

-- ---- Asignar todos los permisos a SUPER_ADMIN ----
INSERT INTO SEC_ROLES_PERMISOS (ROL_ID, PERMISO_ID)
SELECT r.ROL_ID, p.PERMISO_ID
FROM   SEC_ROLES r, SEC_PERMISOS p
WHERE  r.CODIGO = 'SUPER_ADMIN'
AND    NOT EXISTS (
  SELECT 1 FROM SEC_ROLES_PERMISOS rp
  WHERE rp.ROL_ID = r.ROL_ID AND rp.PERMISO_ID = p.PERMISO_ID
);

-- ---- Permisos para MEDICO ----
INSERT INTO SEC_ROLES_PERMISOS (ROL_ID, PERMISO_ID)
SELECT r.ROL_ID, p.PERMISO_ID
FROM   SEC_ROLES r, SEC_PERMISOS p
WHERE  r.CODIGO = 'MEDICO'
AND    p.CODIGO IN (
  'patients.view', 'patients.create', 'patients.edit',
  'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.delete',
  'emergency.view', 'emergency.create', 'emergency.edit',
  'hospitalization.view', 'hospitalization.create', 'hospitalization.edit',
  'surgery.view', 'surgery.create', 'surgery.approve',
  'laboratory.view', 'laboratory.create',
  'pharmacy.view', 'nursing.view'
)
AND NOT EXISTS (
  SELECT 1 FROM SEC_ROLES_PERMISOS rp
  WHERE rp.ROL_ID = r.ROL_ID AND rp.PERMISO_ID = p.PERMISO_ID
);

-- ---- Permisos para ENFERMERO ----
INSERT INTO SEC_ROLES_PERMISOS (ROL_ID, PERMISO_ID)
SELECT r.ROL_ID, p.PERMISO_ID
FROM   SEC_ROLES r, SEC_PERMISOS p
WHERE  r.CODIGO = 'ENFERMERO'
AND    p.CODIGO IN (
  'patients.view', 'appointments.view',
  'emergency.view', 'emergency.edit',
  'hospitalization.view', 'hospitalization.edit',
  'nursing.view', 'nursing.create', 'nursing.edit',
  'pharmacy.view', 'laboratory.view'
)
AND NOT EXISTS (
  SELECT 1 FROM SEC_ROLES_PERMISOS rp
  WHERE rp.ROL_ID = r.ROL_ID AND rp.PERMISO_ID = p.PERMISO_ID
);

-- ---- Permisos para FARMACEUTICO ----
INSERT INTO SEC_ROLES_PERMISOS (ROL_ID, PERMISO_ID)
SELECT r.ROL_ID, p.PERMISO_ID
FROM   SEC_ROLES r, SEC_PERMISOS p
WHERE  r.CODIGO = 'FARMACEUTICO'
AND    p.CODIGO IN (
  'patients.view', 'pharmacy.view', 'pharmacy.dispense', 'pharmacy.create',
  'warehouse.view'
)
AND NOT EXISTS (
  SELECT 1 FROM SEC_ROLES_PERMISOS rp
  WHERE rp.ROL_ID = r.ROL_ID AND rp.PERMISO_ID = p.PERMISO_ID
);

-- ---- Permisos para AUDITOR (solo lectura global) ----
INSERT INTO SEC_ROLES_PERMISOS (ROL_ID, PERMISO_ID)
SELECT r.ROL_ID, p.PERMISO_ID
FROM   SEC_ROLES r, SEC_PERMISOS p
WHERE  r.CODIGO = 'AUDITOR'
AND    p.ACCION IN ('view', 'audit')
AND NOT EXISTS (
  SELECT 1 FROM SEC_ROLES_PERMISOS rp
  WHERE rp.ROL_ID = r.ROL_ID AND rp.PERMISO_ID = p.PERMISO_ID
);

COMMIT;
PROMPT ✅ Roles, permisos y asignaciones insertados.
