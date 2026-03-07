-- ============================================================
-- HealthTech Solutions — DDL: SEC_ROLES, SEC_PERMISOS, SEC_ROLES_PERMISOS
-- Catálogos globales — sin VPD (todos los hospitales comparten roles)
-- Compatible: Oracle 19c RAC y Oracle 21c XE
-- ============================================================

-- ---- 1. SEC_ROLES ----
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE SEC_ROLES (
      ROL_ID            NUMBER          DEFAULT SEQ_SEC_ROLES.NEXTVAL
                                        CONSTRAINT PK_SEC_ROLES PRIMARY KEY,
      CODIGO            VARCHAR2(50)    NOT NULL,
      NOMBRE            VARCHAR2(100)   NOT NULL,
      DESCRIPCION       VARCHAR2(500),
      NIVEL             NUMBER(1)       NOT NULL,   -- 1=SuperAdmin 2=Admin 3=Clínico 4=Apoyo 5=Externo
      ES_SISTEMA        NUMBER(1)       DEFAULT 0,  -- 1=No modificable por usuarios
      ACTIVO            NUMBER(1)       DEFAULT 1   NOT NULL,
      CREATED_AT        TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
      UPDATED_AT        TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
      -- Constraints
      CONSTRAINT UK_SEC_ROLES_CODIGO  UNIQUE (CODIGO),
      CONSTRAINT CHK_SEC_ROLES_NIVEL  CHECK (NIVEL BETWEEN 1 AND 5),
      CONSTRAINT CHK_SEC_ROLES_SIS    CHECK (ES_SISTEMA IN (0, 1)),
      CONSTRAINT CHK_SEC_ROLES_ACT    CHECK (ACTIVO IN (0, 1))
    ) TABLESPACE HT_DATA';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -955 THEN
      DBMS_OUTPUT.PUT_LINE('Tabla SEC_ROLES ya existe — omitiendo.');
    ELSE RAISE;
    END IF;
END;
/

-- ---- 2. SEC_PERMISOS ----
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE SEC_PERMISOS (
      PERMISO_ID        NUMBER          DEFAULT SEQ_SEC_PERMISOS.NEXTVAL
                                        CONSTRAINT PK_SEC_PERMISOS PRIMARY KEY,
      MODULO            VARCHAR2(50)    NOT NULL,   -- patients, pharmacy, etc.
      ACCION            VARCHAR2(30)    NOT NULL,   -- view, create, edit, delete, export
      CODIGO            VARCHAR2(100)   NOT NULL,   -- patients.create, pharmacy.dispense
      DESCRIPCION       VARCHAR2(300),
      CREATED_AT        TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
      -- Constraints
      CONSTRAINT UK_SEC_PERMISOS_COD  UNIQUE (CODIGO),
      CONSTRAINT CHK_SEC_PERM_ACCION  CHECK (
        ACCION IN (''view'', ''create'', ''edit'', ''delete'',
                   ''export'', ''approve'', ''dispense'', ''audit'')
      )
    ) TABLESPACE HT_DATA';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -955 THEN
      DBMS_OUTPUT.PUT_LINE('Tabla SEC_PERMISOS ya existe — omitiendo.');
    ELSE RAISE;
    END IF;
END;
/

-- ---- 3. SEC_ROLES_PERMISOS (Tabla de unión) ----
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE SEC_ROLES_PERMISOS (
      ROL_ID            NUMBER          NOT NULL,
      PERMISO_ID        NUMBER          NOT NULL,
      CREATED_AT        TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
      -- PK compuesta
      CONSTRAINT PK_SEC_ROLES_PERMISOS PRIMARY KEY (ROL_ID, PERMISO_ID),
      -- FKs
      CONSTRAINT FK_SRP_ROL     FOREIGN KEY (ROL_ID)
        REFERENCES SEC_ROLES (ROL_ID) ON DELETE CASCADE,
      CONSTRAINT FK_SRP_PERMISO FOREIGN KEY (PERMISO_ID)
        REFERENCES SEC_PERMISOS (PERMISO_ID) ON DELETE CASCADE
    ) TABLESPACE HT_DATA';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -955 THEN
      DBMS_OUTPUT.PUT_LINE('Tabla SEC_ROLES_PERMISOS ya existe — omitiendo.');
    ELSE RAISE;
    END IF;
END;
/

-- Índices
BEGIN
  EXECUTE IMMEDIATE
    'CREATE INDEX IDX_SRP_PERMISO ON SEC_ROLES_PERMISOS (PERMISO_ID) TABLESPACE HT_DATA';
EXCEPTION
  WHEN OTHERS THEN IF SQLCODE = -955 THEN NULL; ELSE RAISE; END IF;
END;
/

-- Triggers UPDATED_AT
CREATE OR REPLACE TRIGGER TRG_SEC_ROLES_UPD
  BEFORE UPDATE ON SEC_ROLES FOR EACH ROW
BEGIN :NEW.UPDATED_AT := SYSTIMESTAMP; END;
/

PROMPT ✅ Tablas SEC_ROLES, SEC_PERMISOS, SEC_ROLES_PERMISOS creadas.
