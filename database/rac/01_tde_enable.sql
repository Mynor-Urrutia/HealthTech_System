-- ============================================================
-- HealthTech Solutions — TDE: Transparent Data Encryption
-- Ejecutar en: Oracle 19c RAC como SYSDBA
-- Compatible Oracle 19c — NO requiere Oracle 21c
-- Prerequisito: sqlnet.ora con WALLET configurado
-- ============================================================

-- Paso 1: Crear el Keystore (wallet)
-- Ejecutar desde cada nodo del RAC
ADMINISTER KEY MANAGEMENT CREATE KEYSTORE '/opt/oracle/wallet'
IDENTIFIED BY "&&wallet_password";

-- Paso 2: Abrir el Keystore
ADMINISTER KEY MANAGEMENT SET KEYSTORE OPEN
IDENTIFIED BY "&&wallet_password" CONTAINER=ALL;

-- Paso 3: Crear y activar la Master Key
ADMINISTER KEY MANAGEMENT SET KEY
IDENTIFIED BY "&&wallet_password"
WITH BACKUP USING 'healthtech_master_key_backup'
CONTAINER=ALL;

-- Paso 4: Auto-login para que RAC abra el wallet automáticamente al iniciar
ADMINISTER KEY MANAGEMENT CREATE AUTO_LOGIN KEYSTORE
FROM KEYSTORE '/opt/oracle/wallet'
IDENTIFIED BY "&&wallet_password";

-- Paso 5: Cifrar el tablespace PHI_DATA
-- IMPORTANTE: En Oracle 19c se usa ENCRYPT ONLINE (no interrumpe el servicio)
ALTER TABLESPACE PHI_DATA ENCRYPTION ONLINE
USING 'AES256'
ENCRYPT;

-- Verificar TDE activo
SELECT TABLESPACE_NAME, ENCRYPTED
FROM   DBA_TABLESPACES
WHERE  TABLESPACE_NAME IN ('PHI_DATA', 'HT_DATA');

-- Ver estado del Keystore
SELECT STATUS, WALLET_TYPE
FROM   V$ENCRYPTION_WALLET;
