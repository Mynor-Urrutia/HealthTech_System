"""
HealthTech Solutions — Serializers: Módulo Laboratorio (M07)
HIPAA Data Minimization:
  - List:   campos mínimos para tabla/agenda
  - Detail: campos completos con PHI + resultados anidados
  - Create: validación de campos de entrada
  - Actions: Procesar (muestra), Completar (resultados), Cancelar
"""

from rest_framework import serializers

from .models import OrdenLab, ResultadoLab, ESTADOS_ACTIVOS


# ============================================================
# 1. ResultadoSerializer — Resultado individual de examen
# ============================================================
class ResultadoSerializer(serializers.ModelSerializer):
    estado_resultado_display = serializers.CharField(
        source='get_estado_resultado_display', read_only=True,
    )

    class Meta:
        model  = ResultadoLab
        fields = [
            'res_id',
            'nombre_examen', 'valor', 'unidad',
            'rango_min', 'rango_max', 'valor_referencia',
            'interpretacion',
            'estado_resultado', 'estado_resultado_display',
            'created_at',
        ]
        read_only_fields = ['res_id', 'created_at']


# ============================================================
# 2. OrdenLabListSerializer — Vista de lista (data-minimization)
# ============================================================
class OrdenLabListSerializer(serializers.ModelSerializer):
    paciente_nombre      = serializers.SerializerMethodField()
    paciente_expediente  = serializers.SerializerMethodField()
    medico_nombre        = serializers.SerializerMethodField()
    estado_display       = serializers.CharField(source='get_estado_display',       read_only=True)
    prioridad_display    = serializers.CharField(source='get_prioridad_display',    read_only=True)
    tipo_muestra_display = serializers.CharField(source='get_tipo_muestra_display', read_only=True)
    hora_solicitud_fmt   = serializers.SerializerMethodField()
    total_resultados     = serializers.SerializerMethodField()

    class Meta:
        model  = OrdenLab
        fields = [
            'lab_id',
            'fecha_solicitud', 'hora_solicitud', 'hora_solicitud_fmt',
            'prioridad', 'prioridad_display',
            'tipo_muestra', 'tipo_muestra_display',
            'grupo_examen', 'examenes_solicitados',
            'estado', 'estado_display',
            'paciente_nombre', 'paciente_expediente',
            'medico_nombre',
            'total_resultados',
            'activo', 'hospital_id',
        ]

    def get_paciente_nombre(self, obj):
        p = obj.paciente
        return f"{p.primer_nombre} {p.primer_apellido}".strip() if p else ''

    def get_paciente_expediente(self, obj):
        return obj.paciente.no_expediente if obj.paciente else ''

    def get_medico_nombre(self, obj):
        u = obj.medico_solic
        return f"{u.primer_nombre} {u.primer_apellido}".strip() if u else ''

    def get_hora_solicitud_fmt(self, obj):
        return obj.hora_solicitud.strftime('%H:%M') if obj.hora_solicitud else ''

    def get_total_resultados(self, obj):
        return obj.resultados.filter(activo=True).count()


# ============================================================
# 3. OrdenLabDetailSerializer — Vista detalle con resultados
# ============================================================
class OrdenLabDetailSerializer(OrdenLabListSerializer):
    laboratorista_nombre = serializers.SerializerMethodField()
    hora_muestra_fmt     = serializers.SerializerMethodField()
    hora_resultado_fmt   = serializers.SerializerMethodField()
    resultados           = serializers.SerializerMethodField()

    class Meta(OrdenLabListSerializer.Meta):
        fields = OrdenLabListSerializer.Meta.fields + [
            # Personal de laboratorio
            'laboratorista_nombre',
            # Toma de muestra
            'fecha_muestra', 'hora_muestra', 'hora_muestra_fmt',
            # Entrega de resultados
            'fecha_resultado', 'hora_resultado', 'hora_resultado_fmt',
            # Notas clínicas (PHI)
            'observaciones_clin', 'notas_laboratorio',
            # Cancelación
            'motivo_cancelacion',
            # Resultados individuales anidados
            'resultados',
            # Auditoría
            'created_at', 'updated_at',
        ]

    def get_laboratorista_nombre(self, obj):
        u = obj.laboratorista
        return f"{u.primer_nombre} {u.primer_apellido}".strip() if u else 'No asignado'

    def get_hora_muestra_fmt(self, obj):
        return obj.hora_muestra.strftime('%H:%M') if obj.hora_muestra else ''

    def get_hora_resultado_fmt(self, obj):
        return obj.hora_resultado.strftime('%H:%M') if obj.hora_resultado else ''

    def get_resultados(self, obj):
        qs = obj.resultados.filter(activo=True).order_by('nombre_examen')
        return ResultadoSerializer(qs, many=True).data


# ============================================================
# 4. OrdenLabCreateSerializer — Solicitar nueva orden
# ============================================================
class OrdenLabCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = OrdenLab
        fields = [
            'paciente', 'medico_solic',
            'emergencia', 'encamamiento', 'cita',
            'fecha_solicitud', 'hora_solicitud',
            'prioridad', 'tipo_muestra', 'grupo_examen',
            'examenes_solicitados', 'observaciones_clin',
        ]

    def validate_examenes_solicitados(self, value):
        if len(value.strip()) < 3:
            raise serializers.ValidationError(
                "Debe especificar al menos un examen."
            )
        return value.strip()

    def create(self, validated_data):
        request = self.context['request']
        user    = request.user
        validated_data['hospital_id']   = getattr(user, 'hospital_id', 1)
        validated_data['estado']        = 'PENDIENTE'
        validated_data['created_by_id'] = user.pk
        validated_data['updated_by_id'] = user.pk
        return super().create(validated_data)


# ============================================================
# 5. OrdenProcesarSerializer — PENDIENTE → EN_PROCESO
# ============================================================
class OrdenProcesarSerializer(serializers.Serializer):
    """
    Registra la toma de muestra.
    La hora de toma se captura automáticamente en el servidor.
    """
    laboratorista_id  = serializers.IntegerField(
        required=False, allow_null=True,
        help_text="ID del laboratorista que recibe/procesa la muestra.",
    )
    notas_laboratorio = serializers.CharField(
        required=False, allow_blank=True, default='',
        help_text="Observaciones de laboratorio al momento de tomar la muestra.",
    )


# ============================================================
# 6. ResultadoInputSerializer — Un resultado dentro del completar
# ============================================================
class ResultadoInputSerializer(serializers.Serializer):
    nombre_examen    = serializers.CharField(required=True,  max_length=200)
    valor            = serializers.CharField(required=True,  max_length=500)
    unidad           = serializers.CharField(required=False, allow_blank=True, default='',    max_length=50)
    rango_min        = serializers.CharField(required=False, allow_blank=True, default='',    max_length=100)
    rango_max        = serializers.CharField(required=False, allow_blank=True, default='',    max_length=100)
    valor_referencia = serializers.CharField(required=False, allow_blank=True, default='',    max_length=200)
    interpretacion   = serializers.CharField(required=False, allow_blank=True, default='',    max_length=500)
    estado_resultado = serializers.ChoiceField(
        choices=['NORMAL', 'ALTO', 'BAJO', 'CRITICO'],
        default='NORMAL',
    )


# ============================================================
# 7. OrdenCompletarSerializer — EN_PROCESO → COMPLETADA
# ============================================================
class OrdenCompletarSerializer(serializers.Serializer):
    """
    Completa la orden con los resultados individuales de cada examen.
    Se requiere al menos un resultado.
    """
    resultados = serializers.ListField(
        child=ResultadoInputSerializer(),
        min_length=1,
        help_text="Lista de resultados (mínimo 1 examen con resultado).",
    )
    notas_laboratorio = serializers.CharField(
        required=False, allow_blank=True, default='',
        help_text="Notas finales de laboratorio.",
    )


# ============================================================
# 8. OrdenCancelarSerializer — Cancelar orden
# ============================================================
class OrdenCancelarSerializer(serializers.Serializer):
    motivo = serializers.CharField(
        required=True, min_length=5,
        help_text="Motivo de la cancelación (mín. 5 caracteres).",
    )
