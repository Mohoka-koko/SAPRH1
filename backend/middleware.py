from django.utils import timezone


class ActualizarActividadMiddleware:

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):

        response = self.get_response(request)

        if request.user.is_authenticated:
            request.user.ultima_actividad = timezone.now()
            request.user.save(update_fields=['ultima_actividad'])

        return response