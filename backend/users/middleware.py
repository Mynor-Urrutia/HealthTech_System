from django.utils.deprecation import MiddlewareMixin
from .models import AuditLog

class AuditMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        if request.path.startswith('/api/'):
            user = getattr(request, 'user', None)
            if user and user.is_authenticated:
                ip = request.META.get('REMOTE_ADDR')
                AuditLog.objects.create(
                    user=user,
                    action=request.method,
                    path=request.path,
                    ip_address=ip,
                    details=f"Status: {response.status_code}"
                )
        return response
