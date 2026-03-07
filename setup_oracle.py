"""
Script de configuración inicial Oracle XE para HealthTech DEV.
Ejecutar desde la raíz del proyecto: python setup_oracle.py
"""
import oracledb
import time

SYS_PASSWORD    = 'Myn0r0406.'
APP_USER        = 'healthtech_dev'
APP_PASSWORD    = 'TuPasswordAqui123'
CDB_DSN         = '10.0.0.21:1521/racdb'

def main():
    print('=' * 55)
    print('  HealthTech Solutions — Oracle XE Setup')
    print('=' * 55)

    # ── 1. Conectar al CDB como SYSDBA ─────────────────────
    print('\n[1] Conectando al CDB (XE) como SYSDBA...')
    cdb = oracledb.connect(
        user='sys',
        password=SYS_PASSWORD,
        dsn=CDB_DSN,
        mode=oracledb.AUTH_MODE_SYSDBA
    )
    print(f'    OK — Oracle {cdb.version}')

    cur = cdb.cursor()

    # Verificar estado del PDB
    cur.execute("SELECT NAME, OPEN_MODE FROM V$PDBS")
    print('\n[2] Estado de PDBs:')
    for row in cur.fetchall():
        print(f'    {row[0]:15s} {row[1]}')

    # Forzar registro del listener
    print('\n[3] Forzando registro de servicios en el listener...')
    cur.execute('ALTER SYSTEM REGISTER')
    print('    OK')
    cur.close()
    cdb.close()

    time.sleep(5)

    # ── 2. Conectar al servicio de la BD (racdb) ─────────────
    print('\n[4] Conectando a racdb...')
    pdb = oracledb.connect(
        user='sys',
        password=SYS_PASSWORD,
        dsn=CDB_DSN,
        mode=oracledb.AUTH_MODE_SYSDBA
    )
    cur = pdb.cursor()
    print('    OK — conectado a racdb')

    # ── 3. Verificar db_create_file_dest (OMF) ──────────────
    cur.execute("SELECT VALUE FROM V$PARAMETER WHERE NAME = 'db_create_file_dest'")
    row = cur.fetchone()
    omf_dest = row[0] if row else None
    print(f'\n[5] db_create_file_dest = {omf_dest or "(no configurado)"}')

    # ── 4. Buscar ruta de datafiles existentes ───────────────
    print('\n[6] Buscando ruta de datafiles del PDB...')
    cur.execute("""
        SELECT FILE_NAME FROM DBA_DATA_FILES
        WHERE ROWNUM = 1
    """)
    row = cur.fetchone()
    if row:
        import os
        data_dir = os.path.dirname(row[0])
        print(f'    Directorio de datos: {data_dir}')
    else:
        # Fallback: ruta típica de Oracle XE en Windows
        data_dir = r'C:\app\admin\product\21c\oradata\XE\XEPDB1'
        print(f'    Usando ruta por defecto: {data_dir}')

    # ── 5. Crear tablespaces ─────────────────────────────────
    print('\n[7] Creando tablespaces...')
    
    for ts_name, ts_size, ts_next in [('HT_DATA', '500M', '100M'), ('PHI_DATA', '200M', '50M')]:
        try:
            if omf_dest:
                # OMF enables us to omit the DATAFILE path
                sql = (
                    f"CREATE TABLESPACE {ts_name} "
                    f"DATAFILE SIZE {ts_size} "
                    f"AUTOEXTEND ON NEXT {ts_next} "
                    f"SEGMENT SPACE MANAGEMENT AUTO"
                )
            else:
                # Use standard file naming if OMF not available, useful in RAC with specific mounts
                ts_file = f"{data_dir}/{ts_name.lower()}01.dbf" if '/' in data_dir else f"{data_dir}\\{ts_name.lower()}01.dbf"
                sql = (
                    f"CREATE TABLESPACE {ts_name} "
                    f"DATAFILE '{ts_file}' SIZE {ts_size} REUSE "
                    f"AUTOEXTEND ON NEXT {ts_next} "
                    f"SEGMENT SPACE MANAGEMENT AUTO"
                )
            
            cur.execute(sql)
            print(f'    {ts_name}: creado')
        except oracledb.DatabaseError as e:
            code = e.args[0].code if hasattr(e.args[0], 'code') else 0
            if code in (1543, 1119):
                print(f'    {ts_name}: ya existe (OK)')
            else:
                print(f'    {ts_name}: ERROR {e}')
                raise

    # ── 5. Crear usuario healthtech_dev ─────────────────────
    print(f'\n[7] Creando usuario {APP_USER}...')
    try:
        cur.execute(f"""
            CREATE USER {APP_USER}
            IDENTIFIED BY "{APP_PASSWORD}"
            DEFAULT TABLESPACE HT_DATA
            TEMPORARY TABLESPACE TEMP
            QUOTA UNLIMITED ON HT_DATA
            QUOTA UNLIMITED ON PHI_DATA
        """)
        print(f'    {APP_USER}: creado')
    except oracledb.DatabaseError as e:
        code = e.args[0].code if hasattr(e.args[0], 'code') else 0
        if code == 1920:
            print(f'    {APP_USER}: ya existe, actualizando contraseña...')
            cur.execute(f'ALTER USER {APP_USER} IDENTIFIED BY "{APP_PASSWORD}"')
            print(f'    Contraseña actualizada')
        else:
            print(f'    ERROR: {e}')
            raise

    # ── 6. Permisos ─────────────────────────────────────────
    print(f'\n[8] Otorgando permisos a {APP_USER}...')
    grants = [
        'CREATE SESSION',
        'CREATE TABLE',
        'CREATE SEQUENCE',
        'CREATE PROCEDURE',
        'CREATE VIEW',
        'CREATE TRIGGER',
        'CREATE TYPE',
    ]
    cur.execute(f"GRANT {', '.join(grants)} TO {APP_USER}")
    print(f'    OK — {len(grants)} privilegios otorgados')

    pdb.commit()
    cur.close()
    pdb.close()

    # ── 7. Probar conexión como healthtech_dev ───────────────
    print(f'\n[9] Probando conexión como {APP_USER} via CDB...')
    try:
        # Intentar via service name directo (necesita que listener lo tenga)
        test = oracledb.connect(
            user=APP_USER,
            password=APP_PASSWORD,
            dsn='10.0.0.21:1521/racdb'
        )
        test.close()
        print(f'    OK — conexión a racdb exitosa!')
        listener_ok = True
    except Exception as e:
        print(f'    No disponible via listener todavía: {e}')
        print(f'    (El usuario fue creado correctamente en el PDB)')
        listener_ok = False

    print('\n' + '=' * 55)
    if listener_ok:
        print('  EXITO COMPLETO — listo para ejecutar setup_dev')
    else:
        print('  Usuario creado. El listener puede tardar en registrar')
        print('  el servicio XEPDB1. Espera 30 segundos y reintenta.')
    print('=' * 55)
    print(f'  Usuario Oracle : {APP_USER}')
    print(f'  Password Oracle: {APP_PASSWORD}')
    print('=' * 55)

if __name__ == '__main__':
    main()
