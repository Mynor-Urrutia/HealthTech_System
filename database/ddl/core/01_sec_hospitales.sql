-- ============================================================
-- HealthTech Solutions — DDL: SEC_HOSPITALES
-- Tabla maestra de hospitales de la red (sin VPD — tabla global)
-- Compatible: Oracle 19c RAC y Oracle 21c XE
-- ============================================================

BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE SEC_HOSPITALES (
      HOSPITAL_ID       NUMBER          DEFAULT SEQ_SEC_HOSPITALES.NEXTVAL
                                        CONSTRAINT PK_SEC_HOSPITALES PRIMARY KEY,
      CODIGO            VARCHAR2(20)    NOT NULL,
      NOMBRE            VARCHAR2(150)   NOT NULL,
      NOMBRE_CORTO      VARCHAR2(50)    NOT NULL,
      DIRECCION         VARCHAR2(300),
      TELEFONO          VARCHAR2(20),
      EMAIL             VARCHAR2(100),
      NIT               VARCHAR2(20),
      LOGO_S3_KEY       VARCHAR2(500),      -- Ruta en AWS S3 (no BLOB)
      TIMEZONE          VARCHAR2(50)    DEFAULT ''America/Guatemala'',
      ACTIVO            NUMBER(1)       DEFAULT 1 NOT NULL,
      -- Auditoría (sin FK a usuarios — tabla raíz del sistema)
      CREATED_AT        TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
      UPDATED_AT        TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
      -- Constraints
      CONSTRAINT UK_SEC_HOSP_CODIGO  UNIQUE (CODIGO),
      CONSTRAINT UK_SEC_HOSP_NIT     UNIQUE (NIT),
      CONSTRAINT CHK_SEC_HOSP_ACTIVO CHECK (ACTIVO IN (0, 1))
    ) TABLESPACE HT_DATA';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -955 THEN
      DBMS_OUTPUT.PUT_LINE('Tabla SEC_HOSPITALES ya existe — omitiendo.');
    ELSE RAISE;
    END IF;
END;
/

-- Índices de búsqueda frecuente
BEGIN
  EXECUTE IMMEDIATE
    'CREATE INDEX IDX_SEC_HOSP_ACTIVO ON SEC_HOSPITALES (ACTIVO) TABLESPACE HT_DATA';
EXCEPTION
  WHEN OTHERS THEN IF SQLCODE = -955 THEN NULL; ELSE RAISE; END IF;
END;
/

-- Trigger para actualizar UPDATED_AT automáticamente (Oracle 19c)
CREATE OR REPLACE TRIGGER TRG_SEC_HOSPITALES_UPD
  BEFORE UPDATE ON SEC_HOSPITALES
  FOR EACH ROW
BEGIN
  :NEW.UPDATED_AT := SYSTIMESTAMP;
END;
/

PROMPT ✅ Tabla SEC_HOSPITALES creada.
