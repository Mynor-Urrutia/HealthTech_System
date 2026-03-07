-- ============================================================
-- HealthTech Solutions — VPD: Virtual Private Database
-- Contexto de aplicación + Políticas de seguridad por hospital
-- Compatible: Oracle 19c y Oracle 21c XE
-- Ejecutar como: healthtech_app o DBA
-- ============================================================

-- ---- 1. Contexto de Aplicación (Application Context) ----
-- Almacena el hospital_id por sesión de forma segura
CREATE OR REPLACE CONTEXT HEALTHTECH_CTX
  USING HEALTHTECH_PKG
  ACCESSED GLOBALLY;    -- GLOBALLY: compatible con connection pool
/

-- ---- 2. Paquete PL/SQL para manejar el contexto ----
CREATE OR REPLACE PACKAGE HEALTHTECH_PKG AS

  -- Establece el hospital activo para la sesión (llamado por Django VPD middleware)
  PROCEDURE SET_HOSPITAL(p_hospital_id IN NUMBER);

  -- Establece el rol del usuario activo (llamado junto a SET_HOSPITAL)
  -- Permite a SUPER_ADMIN acceder a todos los hospitales sin filtro VPD
  PROCEDURE SET_USER_ROL(p_rol IN VARCHAR2);

  -- Retorna el hospital activo de la sesión
  FUNCTION GET_HOSPITAL RETURN NUMBER;

  -- Limpia el contexto (logout)
  PROCEDURE CLEAR_CONTEXT;

END HEALTHTECH_PKG;
/

CREATE OR REPLACE PACKAGE BODY HEALTHTECH_PKG AS

  PROCEDURE SET_HOSPITAL(p_hospital_id IN NUMBER) IS
  BEGIN
    -- Usa CLIENT_IDENTIFIER como clave para ACCESSED GLOBALLY
    -- Esto es thread-safe en connection pools
    DBMS_SESSION.SET_CONTEXT(
      namespace => 'HEALTHTECH_CTX',
      attribute => 'HOSPITAL_ID',
      value     => TO_CHAR(p_hospital_id),
      client_id => SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER')
    );
  END SET_HOSPITAL;

  PROCEDURE SET_USER_ROL(p_rol IN VARCHAR2) IS
  BEGIN
    DBMS_SESSION.SET_CONTEXT(
      namespace => 'HEALTHTECH_CTX',
      attribute => 'USER_ROL',
      value     => p_rol,
      client_id => SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER')
    );
  END SET_USER_ROL;

  FUNCTION GET_HOSPITAL RETURN NUMBER IS
  BEGIN
    RETURN TO_NUMBER(
      SYS_CONTEXT('HEALTHTECH_CTX', 'HOSPITAL_ID')
    );
  END GET_HOSPITAL;

  PROCEDURE CLEAR_CONTEXT IS
  BEGIN
    DBMS_SESSION.CLEAR_CONTEXT(
      namespace => 'HEALTHTECH_CTX',
      client_id => SYS_CONTEXT('USERENV', 'CLIENT_IDENTIFIER')
    );
  END CLEAR_CONTEXT;

END HEALTHTECH_PKG;
/

-- ---- 3. Función de política VPD (aplica a tablas clínicas) ----
-- Retorna el predicado WHERE que Oracle añade automáticamente
CREATE OR REPLACE FUNCTION VPD_HOSPITAL_POLICY(
  p_schema IN VARCHAR2,
  p_table  IN VARCHAR2
) RETURN VARCHAR2 AS
  v_hospital_id VARCHAR2(10);
  v_rol         VARCHAR2(50);
BEGIN
  v_hospital_id := SYS_CONTEXT('HEALTHTECH_CTX', 'HOSPITAL_ID');
  v_rol         := SYS_CONTEXT('HEALTHTECH_CTX', 'USER_ROL');

  -- SUPER_ADMIN ve todos los hospitales (sin filtro)
  IF v_rol = 'SUPER_ADMIN' THEN
    RETURN '';   -- Sin predicado = sin filtro = acceso total
  END IF;

  -- Sin contexto establecido: no devolver nada
  IF v_hospital_id IS NULL THEN
    RETURN '1=0';  -- Bloquea todo si no hay contexto
  END IF;

  -- Filtro por hospital — se aplica a TODAS las queries automáticamente
  RETURN 'HOSPITAL_ID = ' || v_hospital_id;

END VPD_HOSPITAL_POLICY;
/

-- ---- 4. Aplicar política a las tablas PHI ----
-- Se ejecuta una vez por tabla. Agregar conforme se crean las tablas.
-- Ejemplo con PAC_PACIENTES (Módulo 02):
/*
BEGIN
  DBMS_RLS.ADD_POLICY(
    object_schema   => 'HEALTHTECH_APP',
    object_name     => 'PAC_PACIENTES',
    policy_name     => 'POL_HOSPITAL_PACIENTES',
    function_schema => 'HEALTHTECH_APP',
    policy_function => 'VPD_HOSPITAL_POLICY',
    statement_types => 'SELECT, INSERT, UPDATE, DELETE',
    update_check    => TRUE,     -- INSERT/UPDATE también verificados
    enable          => TRUE
  );
END;
/
*/

-- Verificar políticas activas
SELECT OBJECT_NAME, POLICY_NAME, ENABLE, SEL, INS, UPD, DEL
FROM   DBA_POLICIES
WHERE  OBJECT_OWNER = 'HEALTHTECH_APP'
ORDER BY OBJECT_NAME;
