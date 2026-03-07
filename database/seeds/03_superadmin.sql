-- ============================================================
-- HealthTech Solutions — Seed: Super Administrador inicial
-- IMPORTANTE: Cambiar contraseña después del primer login
-- El hash debe generarse con Django:
--   python manage.py shell -c "from django.contrib.auth.hashers import make_password; print(make_password('Admin@HealthTech2024!'))"
-- Reemplazar &&password_hash con el hash generado
-- Compatible: Oracle 19c y Oracle 21c XE
-- ============================================================

DECLARE
  v_rol_id    NUMBER;
  v_hosp_id   NUMBER := 1;   -- Hospital Central (seed 01)
  v_usr_count NUMBER;
BEGIN
  -- Obtener ROL_ID de SUPER_ADMIN
  SELECT ROL_ID INTO v_rol_id FROM SEC_ROLES WHERE CODIGO = 'SUPER_ADMIN';

  -- Verificar si ya existe
  SELECT COUNT(*) INTO v_usr_count
  FROM SEC_USUARIOS WHERE USERNAME = 'superadmin';

  IF v_usr_count = 0 THEN
    INSERT INTO SEC_USUARIOS (
      HOSPITAL_ID, ROL_ID, USERNAME, PASSWORD_HASH,
      PRIMER_NOMBRE, PRIMER_APELLIDO, EMAIL,
      TIPO_PERSONAL, ACTIVO, IS_ACTIVE,
      DEBE_CAMBIAR_PASS
    ) VALUES (
      v_hosp_id,
      v_rol_id,
      'superadmin',
      '&&password_hash',   -- Reemplazar con hash de Django
      'Super',
      'Admin',
      'superadmin@healthtech.local',
      'OTRO',
      1,
      1,
      1    -- Forzar cambio de contraseña en primer login
    );
    DBMS_OUTPUT.PUT_LINE('✅ Super Admin creado correctamente.');
  ELSE
    DBMS_OUTPUT.PUT_LINE('ℹ️  Super Admin ya existe — omitiendo.');
  END IF;

  COMMIT;
END;
/
