# accounts/views.py

from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone


def login_view(request):
    """
    Vista del formulario de login.
    - GET:  muestra el formulario
    - POST: valida credenciales y redirige según el rol
    """

    # Si el usuario ya está logueado, redirigirlo directamente a su dashboard
    if request.user.is_authenticated:
        return redirect(request.user.get_dashboard_url())

    if request.method == 'POST':
        email    = request.POST.get('email', '').strip().lower()
        password = request.POST.get('password', '')

        # Validar que los campos no estén vacíos
        if not email or not password:
            messages.error(request, 'Por favor ingrese su correo y contraseña.')
            return render(request, 'accounts/login.html')

        # Autenticar al usuario con Django (verifica email + hash de contraseña)
        user = authenticate(request, username=email, password=password)

        if user is not None:
            if user.is_active:
                # Iniciar sesión (crea la cookie de sesión)
                login(request, user)

                # Registrar la fecha/hora del último acceso
                user.ultimo_acceso = timezone.now()
                user.save(update_fields=['ultimo_acceso'])

                # ─── REDIRECCIÓN POR ROL ───
                return redirect(user.get_dashboard_url())
            else:
                messages.error(request, 'Tu cuenta está desactivada. Contacta al administrador.')
        else:
            # Credenciales incorrectas — mensaje genérico por seguridad
            messages.error(request, 'Correo o contraseña incorrectos.')

    return render(request, 'accounts/login.html')


@login_required
def logout_view(request):
    """Cierra la sesión del usuario y redirige al login."""
    logout(request)
    messages.success(request, 'Has cerrado sesión correctamente.')
    return redirect('login')
