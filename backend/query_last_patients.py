import oracledb

def get_last_patient(conn):
    cur = conn.cursor()
    cur.execute("SELECT table_name FROM user_tables WHERE table_name LIKE '%PACIENTE%'")
    tables = cur.fetchall()
    if not tables:
        return 'No se encontro tabla PAT_PACIENTES'
    
    t = tables[0][0]
    try:
        cur.execute(f"SELECT PAC_ID, NO_EXPEDIENTE, PRIMER_NOMBRE, PRIMER_APELLIDO, CREATED_AT FROM {t} ORDER BY CREATED_AT DESC FETCH FIRST 1 ROWS ONLY")
        r = cur.fetchone()
        return f"ID: {r[0]} | Exp: {r[1]} | Nombre: {r[2]} {r[3]} | Creado: {r[4].strftime('%Y-%m-%d %H:%M:%S')}" if r else 'Vacio'
    except Exception as e:
        return f"Error en query: {e}"

print("\n--- CONSULTA DE ÚLTIMO PACIENTE ---")

# 1. LOCAL (21c XE)
try:
    c_local = oracledb.connect(user='healthtech_dev', password='TuPasswordAqui123', dsn='localhost:1521/XEPDB1')
    print("📍 ENTORNO LOCAL (21c XE - localhost):")
    print("   ", get_last_patient(c_local))
    c_local.close()
except Exception as e:
    print("📍 ENTORNO LOCAL (21c XE - localhost):\n    Error conectando:", e)

print("-" * 50)

# 2. RAC CLUSTER (19c)
try:
    dsn_rac = "(DESCRIPTION=(ADDRESS_LIST=(ADDRESS=(PROTOCOL=TCP)(HOST=10.0.0.21)(PORT=1521))(ADDRESS=(PROTOCOL=TCP)(HOST=10.0.0.22)(PORT=1521)))(CONNECT_DATA=(SERVICE_NAME=racdb)))"
    c_rac = oracledb.connect(user='healthtech_dev', password='TuPasswordAqui123', dsn=dsn_rac)
    print("☁️  CLÚSTER RAC (19c - 10.0.0.21/22):")
    print("   ", get_last_patient(c_rac))
    c_rac.close()
except Exception as e:
    print("☁️  CLÚSTER RAC (19c - 10.0.0.21/22):\n    Error conectando:", e)

print("\n")
