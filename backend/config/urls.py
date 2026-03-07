"""
HealthTech Solutions — URL Configuration
Versión de API: v1
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from apps.core.views import HealthCheckView

urlpatterns = [
    path('admin/', admin.site.urls),

    # Health Check — sin autenticación (para load balancer / Proxmox)
    path('api/v1/health/', HealthCheckView.as_view(), name='health-check'),

    # Autenticación JWT
    path('api/v1/auth/', include('apps.security.urls')),

    # Módulos clínicos
    path('api/v1/patients/',         include('apps.patients.urls')),
    path('api/v1/appointments/',     include('apps.appointments.urls')),
    path('api/v1/emergency/',        include('apps.emergency.urls')),
    path('api/v1/hospitalization/',  include('apps.hospitalization.urls')),
    path('api/v1/surgery/',          include('apps.surgery.urls')),
    path('api/v1/laboratory/',       include('apps.laboratory.urls')),
    path('api/v1/pharmacy/',         include('apps.pharmacy.urls')),
    path('api/v1/warehouse/',        include('apps.warehouse.urls')),
    path('api/v1/nursing/',          include('apps.nursing.urls')),
    path('api/v1/imaging/',          include('apps.pacs.urls')),    # PACS
]

# Debug toolbar — solo en DEV
if settings.DEBUG:
    try:
        import debug_toolbar
        urlpatterns = [
            path('__debug__/', include(debug_toolbar.urls)),
        ] + urlpatterns
    except ImportError:
        pass
