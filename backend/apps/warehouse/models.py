"""
HealthTech Solutions — Models: Módulo Bodega / Inventario (M09)
Tablas: BOD_PRODUCTOS, BOD_MOVIMIENTOS

No contiene PHI (datos de pacientes).
VPD: HOSPITAL_ID para multitenancy.
Soft-delete: columna ACTIVO — nunca DELETE físico.

Movimientos de inventario:
  ENTRADA → aumenta stock
  SALIDA → reduce stock
  AJUSTE_POSITIVO → aumenta stock (corrección)
  AJUSTE_NEGATIVO → reduce stock (corrección)
  BAJA → reduce stock (descarte por vencimiento o daño)
"""

from django.db import models


CATEGORIA_CHOICES = [
    ('MATERIAL_MEDICO',    'Material Médico'),
    ('INSUMO_QUIRURGICO',  'Insumo Quirúrgico'),
    ('LIMPIEZA',           'Limpieza / Higiene'),
    ('OFICINA',            'Oficina / Administrativo'),
    ('EQUIPO',             'Equipo / Herramienta'),
    ('ALIMENTACION',       'Alimentación'),
    ('OTRO',               'Otro'),
]

TIPO_MOV_CHOICES = [
    ('ENTRADA',          'Entrada'),
    ('SALIDA',           'Salida'),
    ('AJUSTE_POSITIVO',  'Ajuste Positivo'),
    ('AJUSTE_NEGATIVO',  'Ajuste Negativo'),
    ('BAJA',             'Baja / Descarte'),
]

# Movimientos que aumentan stock
TIPOS_POSITIVOS = ('ENTRADA', 'AJUSTE_POSITIVO')
# Movimientos que requieren stock suficiente
TIPOS_NEGATIVOS = ('SALIDA', 'AJUSTE_NEGATIVO', 'BAJA')


class Producto(models.Model):
    """
    Catálogo de productos/insumos del almacén hospitalario.
    Excluye medicamentos (esos van en Farmacia / FAR_MEDICAMENTOS).
    """
    pro_id      = models.AutoField(db_column='PRO_ID', primary_key=True)
    hospital_id = models.IntegerField(db_column='HOSPITAL_ID')

    codigo      = models.CharField(db_column='CODIGO',   max_length=50,  blank=True, default='')
    nombre      = models.CharField(db_column='NOMBRE',   max_length=200)
    descripcion = models.CharField(db_column='DESCRIPCION', max_length=500, blank=True, default='')
    categoria   = models.CharField(
        db_column='CATEGORIA', max_length=30,
        choices=CATEGORIA_CHOICES, default='MATERIAL_MEDICO',
    )
    unidad_medida  = models.CharField(db_column='UNIDAD_MEDIDA', max_length=30, default='unidad')
    stock_actual   = models.DecimalField(db_column='STOCK_ACTUAL',  max_digits=12, decimal_places=3, default=0)
    stock_minimo   = models.DecimalField(db_column='STOCK_MINIMO',  max_digits=12, decimal_places=3, default=0)
    stock_maximo   = models.DecimalField(db_column='STOCK_MAXIMO',  max_digits=12, decimal_places=3, null=True, blank=True)
    precio_unitario = models.DecimalField(
        db_column='PRECIO_UNITARIO', max_digits=12, decimal_places=4, default=0,
    )
    proveedor  = models.CharField(db_column='PROVEEDOR',  max_length=200, blank=True, default='')
    ubicacion  = models.CharField(db_column='UBICACION',  max_length=100, blank=True, default='')

    activo     = models.BooleanField(db_column='ACTIVO', default=True)
    created_by = models.ForeignKey(
        'security.Usuario', db_column='CREATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='productos_creados',
    )
    created_at = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)
    updated_by = models.ForeignKey(
        'security.Usuario', db_column='UPDATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='productos_actualizados',
    )
    updated_at = models.DateTimeField(db_column='UPDATED_AT', auto_now=True)

    class Meta:
        db_table            = 'BOD_PRODUCTOS'
        verbose_name        = 'Producto'
        verbose_name_plural = 'Productos'
        ordering            = ['nombre']
        indexes             = []

    def __str__(self):
        return f'[PRO-{self.pro_id}] {self.nombre}'

    @property
    def estado_stock(self):
        if self.stock_actual <= 0:
            return 'CRITICO'
        if self.stock_actual <= self.stock_minimo:
            return 'BAJO'
        if self.stock_maximo and self.stock_actual >= self.stock_maximo:
            return 'EXCESO'
        return 'OK'


class Movimiento(models.Model):
    """
    Registro inmutable de cada movimiento de inventario.
    Cada movimiento actualiza el stock_actual del Producto (con F()).
    """
    mov_id      = models.AutoField(db_column='MOV_ID', primary_key=True)
    hospital_id = models.IntegerField(db_column='HOSPITAL_ID')

    producto    = models.ForeignKey(
        'warehouse.Producto',
        db_column='PRO_ID', on_delete=models.PROTECT,
        related_name='movimientos',
    )
    tipo_movimiento = models.CharField(
        db_column='TIPO_MOVIMIENTO', max_length=20,
        choices=TIPO_MOV_CHOICES,
    )
    cantidad           = models.DecimalField(db_column='CANTIDAD',           max_digits=12, decimal_places=3)
    cantidad_anterior  = models.DecimalField(db_column='CANTIDAD_ANTERIOR',  max_digits=12, decimal_places=3)
    cantidad_posterior = models.DecimalField(db_column='CANTIDAD_POSTERIOR', max_digits=12, decimal_places=3)

    motivo             = models.CharField(db_column='MOTIVO',            max_length=500, blank=True, default='')
    referencia         = models.CharField(db_column='REFERENCIA',        max_length=200, blank=True, default='')
    departamento       = models.CharField(db_column='DEPARTAMENTO',      max_length=100, blank=True, default='')
    proveedor          = models.CharField(db_column='PROVEEDOR',         max_length=200, blank=True, default='')

    created_by  = models.ForeignKey(
        'security.Usuario', db_column='CREATED_BY', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='movimientos_creados',
    )
    created_at  = models.DateTimeField(db_column='CREATED_AT', auto_now_add=True)

    class Meta:
        db_table            = 'BOD_MOVIMIENTOS'
        verbose_name        = 'Movimiento'
        verbose_name_plural = 'Movimientos'
        ordering            = ['-created_at']
        indexes             = []

    def __str__(self):
        return f'[MOV-{self.mov_id}] {self.tipo_movimiento} {self.cantidad} {self.producto.nombre}'
