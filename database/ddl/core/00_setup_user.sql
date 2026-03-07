-- ============================================================
-- HealthTech Solutions — Setup inicial de usuario y esquema
-- Compatible: Oracle 19c RAC y Oracle 21c XE
-- Ejecutar como: SYSDBA
-- ============================================================

-- ---- DEV: Oracle 21c XE ----
-- Conectar al PDB antes de ejecutar:
-- ALTER SESSION SET CONTAINER = XEPDB1;

-- ---- PROD: Oracle 19c RAC ----
-- Conectar al PDB del RAC:
-- ALTER SESSION SET CONTAINER = HTPDB;

-- Crear tablespace para datos generales
BEGIN
  EXECUTE IMMEDIATE
    'CREATE TABLESPACE HT_DATA
     DATAFILE SIZE 500M
     AUTOEXTEND ON NEXT 100M MAXSIZE 10G
     SEGMENT SPACE MANAGEMENT AUTO';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -1543 THEN NULL;  -- Tablespace ya existe
    ELSE RAISE;
    END IF;
END;
/

-- Crear tablespace para PHI (en PROD se aplica TDE sobre este)
BEGIN
  EXECUTE IMMEDIATE
    'CREATE TABLESPACE PHI_DATA
     DATAFILE SIZE 200M
     AUTOEXTEND ON NEXT 50M MAXSIZE 5G
     SEGMENT SPACE MANAGEMENT AUTO';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -1543 THEN NULL;
    ELSE RAISE;
    END IF;
END;
/

-- Crear usuario de aplicación
BEGIN
  EXECUTE IMMEDIATE
    'CREATE USER healthtech_app
     IDENTIFIED BY "&&app_password"
     DEFAULT TABLESPACE HT_DATA
     TEMPORARY TABLESPACE TEMP
     QUOTA UNLIMITED ON HT_DATA
     QUOTA UNLIMITED ON PHI_DATA';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -1920 THEN NULL;  -- Usuario ya existe
    ELSE RAISE;
    END IF;
END;
/

-- Permisos mínimos necesarios (principio de menor privilegio)
GRANT CREATE SESSION        TO healthtech_app;
GRANT CREATE TABLE          TO healthtech_app;
GRANT CREATE SEQUENCE       TO healthtech_app;
GRANT CREATE PROCEDURE      TO healthtech_app;
GRANT CREATE VIEW           TO healthtech_app;
GRANT CREATE TRIGGER        TO healthtech_app;
GRANT CREATE CONTEXT        TO healthtech_app;

-- Para VPD (solo staging y PROD)
-- GRANT EXECUTE ON DBMS_RLS TO healthtech_app;
-- GRANT EXECUTE ON DBMS_SESSION TO healthtech_app;

-- Para auditoría (solo PROD)
-- GRANT AUDIT_ADMIN TO healthtech_app;

PROMPT ✅ Usuario healthtech_app y tablespaces creados correctamente.
