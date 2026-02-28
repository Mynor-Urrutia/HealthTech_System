from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import CustomUser
from rest_framework import serializers

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'role']

class DoctorListView(generics.ListAPIView):
    queryset = CustomUser.objects.filter(role='DOCTOR')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
