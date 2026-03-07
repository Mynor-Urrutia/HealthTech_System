-- ============================================================
-- HealthTech Solutions — Seed: Red de 10 Hospitales
-- Sistema SaaS multitenancy — 10 hospitales de Guatemala
-- Compatible: Oracle 19c y Oracle 21c XE
-- HIPAA: HOSPITAL_ID es la clave de particionamiento VPD
-- ============================================================
-- Usar MERGE para idempotencia (ejecutar múltiples veces es seguro)
-- ============================================================

MERGE INTO SEC_HOSPITALES h
USING (
  SELECT 1  AS ID, 'HOSP-001' AS COD, 'Hospital Central HealthTech'          AS NOM, 'H. Central'       AS NOM_C, 'Ciudad de Guatemala'  AS DIR, 'Guatemala, Guatemala'  AS ZONA FROM DUAL UNION ALL
  SELECT 2,  'HOSP-002', 'Hospital Norte HealthTech',           'H. Norte',         'Quetzaltenango',      'Quetzaltenango'               FROM DUAL UNION ALL
  SELECT 3,  'HOSP-003', 'Hospital Sur HealthTech',             'H. Sur',           'Escuintla',           'Escuintla'                    FROM DUAL UNION ALL
  SELECT 4,  'HOSP-004', 'Hospital Oriente HealthTech',         'H. Oriente',       'Chiquimula',          'Chiquimula'                   FROM DUAL UNION ALL
  SELECT 5,  'HOSP-005', 'Hospital Occidente HealthTech',       'H. Occidente',     'Huehuetenango',       'Huehuetenango'                FROM DUAL UNION ALL
  SELECT 6,  'HOSP-006', 'Hospital Pediátrico HealthTech',      'H. Pediátrico',    'Guatemala, Z.11',     'Guatemala, Guatemala'         FROM DUAL UNION ALL
  SELECT 7,  'HOSP-007', 'Hospital Maternidad HealthTech',      'H. Maternidad',    'Guatemala, Z.1',      'Guatemala, Guatemala'         FROM DUAL UNION ALL
  SELECT 8,  'HOSP-008', 'Hospital Alta Verapaz HealthTech',    'H. Alta Verapaz',  'Cobán, Alta Verapaz', 'Alta Verapaz'                 FROM DUAL UNION ALL
  SELECT 9,  'HOSP-009', 'Hospital Petén HealthTech',           'H. Petén',         'Flores, Petén',       'Petén'                       FROM DUAL UNION ALL
  SELECT 10, 'HOSP-010', 'Hospital Pacífico HealthTech',        'H. Pacífico',      'Retalhuleu',          'Retalhuleu'                   FROM DUAL
) src ON (h.HOSPITAL_ID = src.ID)
WHEN NOT MATCHED THEN
  INSERT (
    HOSPITAL_ID, CODIGO, NOMBRE, NOMBRE_CORTO, DIRECCION,
    TELEFONO, EMAIL, NIT, TIMEZONE, ACTIVO,
    CREATED_AT, UPDATED_AT
  )
  VALUES (
    src.ID, src.COD, src.NOM, src.NOM_C,
    src.DIR || ', ' || src.ZONA,
    '+502 2' || LPAD(src.ID, 3, '0') || '-0000',
    LOWER(REPLACE(src.COD, '-', '')) || '@healthtech.gt',
    src.ID || '00000-' || src.ID,
    'America/Guatemala',
    1,
    SYSTIMESTAMP,
    SYSTIMESTAMP
  )
WHEN MATCHED THEN
  UPDATE SET
    h.NOMBRE        = src.NOM,
    h.NOMBRE_CORTO  = src.NOM_C,
    h.UPDATED_AT    = SYSTIMESTAMP;

-- Actualizar sequence para que no colisione con los IDs manuales
BEGIN
  EXECUTE IMMEDIATE 'ALTER SEQUENCE SEQ_SEC_HOSPITALES RESTART START WITH 100';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

COMMIT;
PROMPT ✅ 10 hospitales insertados/actualizados.

-- Verificar
SELECT HOSPITAL_ID, CODIGO, NOMBRE, NOMBRE_CORTO, ACTIVO
FROM SEC_HOSPITALES
ORDER BY HOSPITAL_ID;
