"""
HealthTech Solutions — Script de validación de conexión Oracle
Uso: python config/oracle/validate_connection.py
Verifica conectividad con Oracle 21c XE (DEV) o 19c RAC (PROD)
"""

import os
import sys

# Añadir el directorio backend al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from decouple import config

def validate_oracle_connection():
    try:
        import oracledb
    except ImportError:
        print("❌ python-oracledb no está instalado. Ejecuta: pip install python-oracledb")
        return False

    oracle_env = config('ORACLE_ENV', default='dev')
    print(f"\n🔍 Validando conexión Oracle — Entorno: {oracle_env.upper()}\n")

    try:
        if oracle_env == 'dev':
            host     = config('ORACLE_HOST', default='localhost')
            port     = config('ORACLE_PORT', default='1521')
            service  = config('ORACLE_SERVICE', default='XEPDB1')
            user     = config('ORACLE_USER')
            password = config('ORACLE_PASSWORD')
            dsn      = f"{host}:{port}/{service}"

            print(f"  Host:    {host}:{port}")
            print(f"  Service: {service}")
            print(f"  User:    {user}")
        else:
            dsn      = config('ORACLE_OLTP_SERVICE')
            user     = config('ORACLE_USER')
            password = config('ORACLE_PASSWORD')
            print(f"  TNS:  {dsn}")
            print(f"  User: {user}")

        conn = oracledb.connect(user=user, password=password, dsn=dsn)

        with conn.cursor() as cursor:
            # Info básica de la instancia
            cursor.execute(
                "SELECT INSTANCE_NAME, VERSION_FULL, STATUS, HOST_NAME "
                "FROM V$INSTANCE"
            )
            row = cursor.fetchone()
            if row:
                print(f"\n✅ Conexión exitosa:")
                print(f"   Instancia: {row[0]}")
                print(f"   Versión:   {row[1]}")
                print(f"   Estado:    {row[2]}")
                print(f"   Host:      {row[3]}")

            # Verificar que el esquema de aplicación existe
            cursor.execute(
                "SELECT USERNAME, ACCOUNT_STATUS "
                "FROM DBA_USERS WHERE USERNAME = UPPER(:1)",
                [user]
            )
            user_row = cursor.fetchone()
            if user_row:
                print(f"\n✅ Usuario de aplicación:")
                print(f"   Usuario: {user_row[0]}")
                print(f"   Estado:  {user_row[1]}")
            else:
                print(f"\n⚠️  Usuario '{user}' no encontrado. Ejecutar database/ddl/core/00_setup_user.sql")

            # Verificar tablespaces
            cursor.execute(
                "SELECT TABLESPACE_NAME, STATUS FROM DBA_TABLESPACES "
                "WHERE TABLESPACE_NAME IN ('HT_DATA', 'PHI_DATA')"
            )
            ts_rows = cursor.fetchall()
            if ts_rows:
                print(f"\n✅ Tablespaces:")
                for ts in ts_rows:
                    print(f"   {ts[0]}: {ts[1]}")
            else:
                print("\n⚠️  Tablespaces HT_DATA/PHI_DATA no encontrados. Ejecutar setup SQL.")

        conn.close()
        print(f"\n🎉 Validación completada para entorno {oracle_env.upper()}\n")
        return True

    except oracledb.Error as e:
        error, = e.args
        print(f"\n❌ Error Oracle: {error.message}")
        print(f"   Código: {error.code}")

        if error.code == 12541:
            print("   → Oracle no está escuchando. Verifica que el listener esté activo.")
        elif error.code == 1017:
            print("   → Usuario o contraseña incorrectos.")
        elif error.code == 12514:
            print("   → Service Name incorrecto. Verifica ORACLE_SERVICE en .env")

        return False


if __name__ == '__main__':
    success = validate_oracle_connection()
    sys.exit(0 if success else 1)
