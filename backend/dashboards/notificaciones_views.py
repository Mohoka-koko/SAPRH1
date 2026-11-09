from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import render, get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from .models import Notificacion


@login_required
@require_GET
def lista_notificaciones(request):
    """
    Muestra la página con el historial de notificaciones.
    """

    return render(
        request,
        "dashboards/notificaciones/lista_notificaciones.html"
    )


@login_required
@require_GET
def api_notificaciones(request):
    """
    Devuelve las notificaciones del usuario conectado.
    """

    notificaciones = Notificacion.objects.filter(
        destinatario=request.user
    )

    filtro = request.GET.get("filtro", "todas")

    if filtro == "no_leidas":
        notificaciones = notificaciones.filter(
            leida=False
        )

    elif filtro == "leidas":
        notificaciones = notificaciones.filter(
            leida=True
        )

    try:
        limite = int(request.GET.get("limite", 100))
    except (TypeError, ValueError):
        limite = 100

    limite = max(1, min(limite, 200))

    resultados = []

    for notificacion in notificaciones[:limite]:

        resultados.append({
            "id": notificacion.pk,
            "titulo": notificacion.titulo,
            "mensaje": notificacion.mensaje,
            "tipo": notificacion.tipo,
            "url": notificacion.url,
            "leida": notificacion.leida,
            "creada_en": timezone.localtime(
                notificacion.creada_en
            ).strftime("%d/%m/%Y %H:%M"),
        })

    total_no_leidas = Notificacion.objects.filter(
        destinatario=request.user,
        leida=False
    ).count()

    return JsonResponse({
        "ok": True,
        "notificaciones": resultados,
        "no_leidas": total_no_leidas,
    })


@login_required
@require_POST
def marcar_notificacion_leida(request, pk):
    """
    Marca como leída una notificación del usuario conectado.
    """

    notificacion = get_object_or_404(
        Notificacion,
        pk=pk,
        destinatario=request.user
    )

    if not notificacion.leida:

        notificacion.leida = True
        notificacion.leida_en = timezone.now()

        notificacion.save(
            update_fields=[
                "leida",
                "leida_en"
            ]
        )

    return JsonResponse({
        "ok": True
    })


@login_required
@require_POST
def marcar_todas_leidas(request):
    """
    Marca como leídas todas las notificaciones
    del usuario conectado.
    """

    ahora = timezone.now()

    Notificacion.objects.filter(
        destinatario=request.user,
        leida=False
    ).update(
        leida=True,
        leida_en=ahora
    )

    return JsonResponse({
        "ok": True
    })