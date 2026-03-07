-- ============================================================
-- HealthTech Solutions — Servicios Oracle RAC
-- Ejecutar en: Oracle 19c RAC como SYSDBA
-- NO ejecutar en Oracle 21c XE (DEV)
-- ============================================================

-- Servicio OLTP — Balanceo entre ambos nodos
BEGIN
  DBMS_SERVICE.CREATE_SERVICE(
    service_name    => 'HEALTHTECH_OLTP',
    network_name    => 'HEALTHTECH_OLTP',
    goal            => DBMS_SERVICE.GOAL_THROUGHPUT,
    clb_goal        => DBMS_SERVICE.CLB_GOAL_LONG,
    failover_method => 'BASIC',
    failover_type   => 'SELECT',
    failover_retries => 30,
    failover_delay  => 1
  );
  DBMS_SERVICE.START_SERVICE('HEALTHTECH_OLTP');
  DBMS_OUTPUT.PUT_LINE('Servicio HEALTHTECH_OLTP creado e iniciado.');
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -44305 THEN
      DBMS_OUTPUT.PUT_LINE('Servicio HEALTHTECH_OLTP ya existe.');
    ELSE RAISE;
    END IF;
END;
/

-- Servicio REPORTS — Preferencia por Nodo 2 para no impactar OLTP
BEGIN
  DBMS_SERVICE.CREATE_SERVICE(
    service_name    => 'HEALTHTECH_REPORTS',
    network_name    => 'HEALTHTECH_REPORTS',
    goal            => DBMS_SERVICE.GOAL_SERVICE_TIME,
    clb_goal        => DBMS_SERVICE.CLB_GOAL_SHORT,
    failover_method => 'BASIC',
    failover_type   => 'SESSION',
    failover_retries => 10,
    failover_delay  => 5
  );
  DBMS_SERVICE.START_SERVICE('HEALTHTECH_REPORTS');
  DBMS_OUTPUT.PUT_LINE('Servicio HEALTHTECH_REPORTS creado e iniciado.');
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -44305 THEN
      DBMS_OUTPUT.PUT_LINE('Servicio HEALTHTECH_REPORTS ya existe.');
    ELSE RAISE;
    END IF;
END;
/

-- Verificar servicios activos
SELECT NAME, NETWORK_NAME, GOAL, CLB_GOAL
FROM   DBA_SERVICES
WHERE  NAME LIKE 'HEALTHTECH%'
ORDER BY NAME;
