"""
HealthTech Solutions — URLs: Módulo de Seguridad
Prefijo: /api/v1/auth/
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from apps.security import views

router = DefaultRouter()
router.register('hospitales', views.HospitalViewSet,     basename='hospitales')
router.register('roles',      views.RolViewSet,          basename='roles')
router.register('usuarios',   views.UsuarioViewSet,      basename='usuarios')
router.register('auditoria',  views.AuditoriaAccesoViewSet, basename='auditoria')

urlpatterns = [
    # ---- Auth JWT ----
    path('token/',          views.LoginView.as_view(),          name='token-obtain'),
    path('token/refresh/',  TokenRefreshView.as_view(),         name='token-refresh'),
    path('logout/',         views.LogoutView.as_view(),         name='logout'),

    # ---- Perfil y contraseña ----
    path('me/',             views.MiPerfilView.as_view(),       name='mi-perfil'),
    path('change-password/', views.CambiarPasswordView.as_view(), name='change-password'),

    # ---- CRUD vía router ----
    path('', include(router.urls)),
]
