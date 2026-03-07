-- ============================================================
-- HealthTech Solutions — DDL: SEC_SESIONES + SEC_AUDITORIA_ACCESOS
-- Auditoría HIPAA: trazabilidad completa de accesos
-- Alta escritura — CACHE 100 en sequences
-- Compatible: Oracle 19c RAC y Oracle 21c XE
-- ============================================================

-- ---- 1. SEC_SESIONES — Control de sesiones JWT activas ----
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE SEC_SESIONES (
      SESION_ID         NUMBER          DEFAULT SEQ_SEC_SESIONES.NEXTVAL
                                        CONSTRAINT PK_SEC_SESIONES PRIMARY KEY,
      HOSPITAL_ID       NUMBER          NOT NULL,       -- VPD column
      USR_ID            NUMBER          NOT NULL,
      REFRESH_TOKEN_JTI VARCHAR2(100)   NOT NULL,       -- JWT ID del refresh token
      IP_ORIGEN         VARCHAR2(45)    NOT NULL,       -- IPv4 o IPv6
      USER_AGENT        VARCHAR2(500),
      DISPOSITIVO       VARCHAR2(100),
      CREADA_EN         TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
      EXPIRA_EN         TIMESTAMP       NOT NULL,
      REVOCADA          NUMBER(1)       DEFAULT 0       NOT NULL,
      REVOCADA_EN       TIMESTAMP,
      MOTIVO_REVOCACION VARCHAR2(100),    -- logout, timeout, admin, password_change
      -- Constraints
      CONSTRAINT UK_SEC_SES_JTI   UNIQUE (REFRESH_TOKEN_JTI),
      CONSTRAINT CHK_SEC_SES_REV  CHECK (REVOCADA IN (0, 1)),
      -- FKs
      CONSTRAINT FK_SES_HOSPITAL  FOREIGN KEY (HOSPITAL_ID)
        REFERENCES SEC_HOSPITALES (HOSPITAL_ID),
      CONSTRAINT FK_SES_USUARIO   FOREIGN KEY (USR_ID)
        REFERENCES SEC_USUARIOS (USR_ID)
    ) TABLESPACE PHI_DATA';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -955 THEN
      DBMS_OUTPUT.PUT_LINE('Tabla SEC_SESIONES ya existe — omitiendo.');
    ELSE RAISE;
    END IF;
END;
/

-- ---- 2. SEC_AUDITORIA_ACCESOS — Log HIPAA de cada operación ----
BEGIN
  EXECUTE IMMEDIATE '
    CREATE TABLE SEC_AUDITORIA_ACCESOS (
      AUDITORIA_ID      NUMBER          DEFAULT SEQ_SEC_AUDITORIA.NEXTVAL
                                        CONSTRAINT PK_SEC_AUDITORIA PRIMARY KEY,
      HOSPITAL_ID       NUMBER,                         -- NULL en intentos fallidos
      USR_ID            NUMBER,                         -- NULL en intentos fallidos
      USERNAME_INTENTO  VARCHAR2(50),                   -- Para logins fallidos
      TIPO_EVENTO       VARCHAR2(50)    NOT NULL,       -- LOGIN_OK, LOGIN_FAIL, LOGOUT, etc.
      MODULO            VARCHAR2(50),                   -- patients, pharmacy, etc.
      ACCION            VARCHAR2(50),                   -- view, create, edit, delete
      TABLA_AFECTADA    VARCHAR2(100),                  -- Para cambios a datos PHI
      REGISTRO_ID       VARCHAR2(50),                   -- PK del registro afectado
      IP_ORIGEN         VARCHAR2(45)    NOT NULL,
      USER_AGENT        VARCHAR2(500),
      DESCRIPCION       VARCHAR2(1000),                 -- Detalle del evento
      EXITOSO           NUMBER(1)       DEFAULT 1       NOT NULL,
      MENSAJE_ERROR     VARCHAR2(500),
      DURACION_MS       NUMBER(10),                     -- Tiempo de respuesta
      CREATED_AT        TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
      -- Constraints
      CONSTRAINT CHK_AUD_EXITOSO CHECK (EXITOSO IN (0, 1)),
      CONSTRAINT CHK_AUD_TIPO    CHECK (
        TIPO_EVENTO IN (
          ''LOGIN_OK'', ''LOGIN_FAIL'', ''LOGOUT'',
          ''TOKEN_REFRESH'', ''TOKEN_REVOKED'',
          ''PASSWORD_CHANGE'', ''ACCOUNT_LOCKED'',
          ''PHI_ACCESS'', ''PHI_MODIFY'', ''PHI_DELETE'',
          ''EXPORT'', ''ADMIN_ACTION''
        )
      )
    ) TABLESPACE PHI_DATA';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -955 THEN
      DBMS_OUTPUT.PUT_LINE('Tabla SEC_AUDITORIA_ACCESOS ya existe — omitiendo.');
    ELSE RAISE;
    END IF;
END;
/

-- Índices para reportes de auditoría HIPAA
BEGIN
  EXECUTE IMMEDIATE
    'CREATE INDEX IDX_AUD_HOSPITAL ON SEC_AUDITORIA_ACCESOS (HOSPITAL_ID, CREATED_AT DESC)
     TABLESPACE PHI_DATA';
EXCEPTION
  WHEN OTHERS THEN IF SQLCODE = -955 THEN NULL; ELSE RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE
    'CREATE INDEX IDX_AUD_USUARIO ON SEC_AUDITORIA_ACCESOS (USR_ID, CREATED_AT DESC)
     TABLESPACE PHI_DATA';
EXCEPTION
  WHEN OTHERS THEN IF SQLCODE = -955 THEN NULL; ELSE RAISE; END IF;
END;
/

BEGIN
  EXECUTE IMMEDIATE
    'CREATE INDEX IDX_AUD_TIPO_FECHA ON SEC_AUDITORIA_ACCESOS (TIPO_EVENTO, CREATED_AT DESC)
     TABLESPACE PHI_DATA';
EXCEPTION
  WHEN OTHERS THEN IF SQLCODE = -955 THEN NULL; ELSE RAISE; END IF;
END;
/

-- Índice para sesiones activas
BEGIN
  EXECUTE IMMEDIATE
    'CREATE INDEX IDX_SES_USR_ACTIVA ON SEC_SESIONES (USR_ID, REVOCADA, EXPIRA_EN)
     TABLESPACE PHI_DATA';
EXCEPTION
  WHEN OTHERS THEN IF SQLCODE = -955 THEN NULL; ELSE RAISE; END IF;
END;
/

PROMPT ✅ Tablas SEC_SESIONES y SEC_AUDITORIA_ACCESOS creadas.
