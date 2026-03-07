-- ============================================================
-- HealthTech Solutions — VPD: Aplicar Políticas a Tablas PHI
-- Ejecutar como DBA o como usuario con privilegio EXECUTE en DBMS_RLS
-- Requiere que 02_vpd_package.sql ya haya sido ejecutado
-- HIPAA: Estas políticas son el mecanismo de aislamiento de datos
--        entre hospitales (multitenancy row-level security)
-- ============================================================
--
-- FUNCIÓN DE POLÍTICA: HEALTHTECH_APP.VPD_HOSPITAL_POLICY
--   - Si USER_ROL = 'SUPER_ADMIN' → sin predicado (acceso total)
--   - Si HOSPITAL_ID no está en contexto → 1=0 (bloquea todo)
--   - En cualquier otro caso → HOSPITAL_ID = <valor_del_contexto>
--
-- COBERTURA:
--   M02 — Pacientes:         PAC_PACIENTES, PAC_ALERGIAS,
--                            PAC_CONTACTOS_EMERG, PAC_HISTORIAL
--   M03 — Citas:             CIT_CITAS
--   M04 — Emergencias:       EMG_EMERGENCIAS
--   M05 — Encamamiento:      ENC_CAMAS, ENC_ENCAMAMIENTOS
--   M06 — Cirugías:          CIR_CIRUGIAS
--   M07 — Laboratorio:       LAB_ORDENES, LAB_RESULTADOS
--   M08 — Farmacia:          FAR_MEDICAMENTOS, FAR_DISPENSACIONES
--   M09 — Bodega:            BOD_PRODUCTOS, BOD_MOVIMIENTOS
--   M10 — Enfermería:        ENF_SIGNOS_VITALES, ENF_NOTAS
-- ============================================================

-- Helper: eliminar política existente si ya existe (idempotente)
CREATE OR REPLACE PROCEDURE DROP_POLICY_IF_EXISTS(
    p_schema IN VARCHAR2,
    p_table  IN VARCHAR2,
    p_policy IN VARCHAR2
) AS
BEGIN
    DBMS_RLS.DROP_POLICY(
        object_schema => p_schema,
        object_name   => p_table,
        policy_name   => p_policy
    );
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE = -28102 THEN NULL;  -- ORA-28102: policy does not exist
        ELSE RAISE;
        END IF;
END DROP_POLICY_IF_EXISTS;
/

-- ============================================================
-- M02 — PAC_PACIENTES
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','PAC_PACIENTES','POL_HOSP_PAC_PACIENTES');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'PAC_PACIENTES',
        policy_name     => 'POL_HOSP_PAC_PACIENTES',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT, UPDATE, DELETE',
        update_check    => TRUE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- M02 — PAC_ALERGIAS
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','PAC_ALERGIAS','POL_HOSP_PAC_ALERGIAS');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'PAC_ALERGIAS',
        policy_name     => 'POL_HOSP_PAC_ALERGIAS',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT, UPDATE, DELETE',
        update_check    => TRUE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- M02 — PAC_CONTACTOS_EMERG
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','PAC_CONTACTOS_EMERG','POL_HOSP_PAC_CONTACTOS');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'PAC_CONTACTOS_EMERG',
        policy_name     => 'POL_HOSP_PAC_CONTACTOS',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT, UPDATE, DELETE',
        update_check    => TRUE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- M02 — PAC_HISTORIAL
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','PAC_HISTORIAL','POL_HOSP_PAC_HISTORIAL');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'PAC_HISTORIAL',
        policy_name     => 'POL_HOSP_PAC_HISTORIAL',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT, UPDATE, DELETE',
        update_check    => TRUE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- M03 — CIT_CITAS
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','CIT_CITAS','POL_HOSP_CIT_CITAS');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'CIT_CITAS',
        policy_name     => 'POL_HOSP_CIT_CITAS',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT, UPDATE, DELETE',
        update_check    => TRUE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- M04 — EMG_EMERGENCIAS
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','EMG_EMERGENCIAS','POL_HOSP_EMG_EMERGENCIAS');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'EMG_EMERGENCIAS',
        policy_name     => 'POL_HOSP_EMG_EMERGENCIAS',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT, UPDATE, DELETE',
        update_check    => TRUE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- M05 — ENC_CAMAS
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','ENC_CAMAS','POL_HOSP_ENC_CAMAS');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'ENC_CAMAS',
        policy_name     => 'POL_HOSP_ENC_CAMAS',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT, UPDATE, DELETE',
        update_check    => TRUE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- M05 — ENC_ENCAMAMIENTOS
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','ENC_ENCAMAMIENTOS','POL_HOSP_ENC_ENCAM');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'ENC_ENCAMAMIENTOS',
        policy_name     => 'POL_HOSP_ENC_ENCAM',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT, UPDATE, DELETE',
        update_check    => TRUE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- M06 — CIR_CIRUGIAS
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','CIR_CIRUGIAS','POL_HOSP_CIR_CIRUGIAS');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'CIR_CIRUGIAS',
        policy_name     => 'POL_HOSP_CIR_CIRUGIAS',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT, UPDATE, DELETE',
        update_check    => TRUE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- M07 — LAB_ORDENES
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','LAB_ORDENES','POL_HOSP_LAB_ORDENES');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'LAB_ORDENES',
        policy_name     => 'POL_HOSP_LAB_ORDENES',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT, UPDATE, DELETE',
        update_check    => TRUE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- M07 — LAB_RESULTADOS
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','LAB_RESULTADOS','POL_HOSP_LAB_RESULTADOS');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'LAB_RESULTADOS',
        policy_name     => 'POL_HOSP_LAB_RESULTADOS',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT, UPDATE, DELETE',
        update_check    => TRUE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- M08 — FAR_MEDICAMENTOS (catálogo por hospital)
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','FAR_MEDICAMENTOS','POL_HOSP_FAR_MED');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'FAR_MEDICAMENTOS',
        policy_name     => 'POL_HOSP_FAR_MED',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT, UPDATE, DELETE',
        update_check    => TRUE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- M08 — FAR_DISPENSACIONES (PHI: vínculo paciente-medicamento)
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','FAR_DISPENSACIONES','POL_HOSP_FAR_DIS');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'FAR_DISPENSACIONES',
        policy_name     => 'POL_HOSP_FAR_DIS',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT, UPDATE, DELETE',
        update_check    => TRUE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- M09 — BOD_PRODUCTOS (catálogo de inventario por hospital)
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','BOD_PRODUCTOS','POL_HOSP_BOD_PRO');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'BOD_PRODUCTOS',
        policy_name     => 'POL_HOSP_BOD_PRO',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT, UPDATE, DELETE',
        update_check    => TRUE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- M09 — BOD_MOVIMIENTOS (trazabilidad inmutable de stock)
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','BOD_MOVIMIENTOS','POL_HOSP_BOD_MOV');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'BOD_MOVIMIENTOS',
        policy_name     => 'POL_HOSP_BOD_MOV',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT',      -- immutable: no UPDATE/DELETE
        update_check    => FALSE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- M10 — ENF_SIGNOS_VITALES (PHI: datos clínicos de enfermería)
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','ENF_SIGNOS_VITALES','POL_HOSP_ENF_SIG');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'ENF_SIGNOS_VITALES',
        policy_name     => 'POL_HOSP_ENF_SIG',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT',      -- append-only: no UPDATE/DELETE
        update_check    => FALSE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- M10 — ENF_NOTAS (PHI: notas clínicas de enfermería)
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','ENF_NOTAS','POL_HOSP_ENF_NOTAS');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'ENF_NOTAS',
        policy_name     => 'POL_HOSP_ENF_NOTAS',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT',      -- append-only: no UPDATE/DELETE
        update_check    => FALSE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- PACS — IMG_ESTUDIOS (PHI: imágenes médicas)
-- ============================================================
BEGIN
    DROP_POLICY_IF_EXISTS('HEALTHTECH_APP','IMG_ESTUDIOS','POL_HOSP_IMG_EST');
    DBMS_RLS.ADD_POLICY(
        object_schema   => 'HEALTHTECH_APP',
        object_name     => 'IMG_ESTUDIOS',
        policy_name     => 'POL_HOSP_IMG_EST',
        function_schema => 'HEALTHTECH_APP',
        policy_function => 'VPD_HOSPITAL_POLICY',
        statement_types => 'SELECT, INSERT, UPDATE, DELETE',
        update_check    => TRUE,
        enable          => TRUE
    );
END;
/

-- ============================================================
-- Limpiar helper temporal
-- ============================================================
DROP PROCEDURE DROP_POLICY_IF_EXISTS;
/

-- ============================================================
-- Verificación final: listar todas las políticas activas
-- ============================================================
SELECT
    OBJECT_NAME,
    POLICY_NAME,
    ENABLE,
    SEL,
    INS,
    UPD,
    DEL,
    CHK_OPTION
FROM   DBA_POLICIES
WHERE  OBJECT_OWNER = 'HEALTHTECH_APP'
ORDER BY OBJECT_NAME;
