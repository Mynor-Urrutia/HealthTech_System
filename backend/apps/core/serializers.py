"""
HealthTech Solutions — Serializers base
Asegura que campos de auditoría sean de solo lectura
y que PHI no se filtre al frontend.
"""

from rest_framework import serializers


class AuditModelSerializer(serializers.ModelSerializer):
    """
    Serializer base para modelos con AuditModel.
    - Campos de auditoría: solo lectura
    - hospital_id: no se expone al cliente (lo maneja el backend)
    - is_active: no se expone directamente
    """

    created_by_name = serializers.SerializerMethodField(read_only=True)
    updated_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        # Las subclases deben definir model y fields
        read_only_fields = (
            'created_by', 'created_at',
            'updated_by', 'updated_at',
            'hospital_id',              # Lo establece el backend automáticamente
        )
        # hospital_id NUNCA en fields del response — VPD ya filtra en BD
        exclude_from_response = ('hospital_id', 'is_active')

    def get_created_by_name(self, obj) -> str | None:
        if obj.created_by:
            return obj.created_by.get_full_name()
        return None

    def get_updated_by_name(self, obj) -> str | None:
        if obj.updated_by:
            return obj.updated_by.get_full_name()
        return None

    def create(self, validated_data):
        """Inyecta hospital_id y created_by desde el request."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['hospital_id'] = request.user.hospital_id
            validated_data['created_by'] = request.user
            validated_data['updated_by'] = request.user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        """Inyecta updated_by desde el request."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['updated_by'] = request.user
        return super().update(instance, validated_data)
