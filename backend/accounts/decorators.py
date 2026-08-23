# accounts/decorators.py
#
# USO en cualquier vista:
#
#   from accounts.decorators import rol_requerido
#
#   @rol_requerido('admin')
#   def mi_vista_solo_admin(request): ...
#
#   @rol_requerido('admin', 'usuariovip')   ← acepta múltiples roles
#   def mi_vista_compartida(request): ...

from functools import wraps
from django.shortcuts import redirect
from django.contrib import messages


def rol_requerido(*roles_permitidos):
    """
    Decorador que protege una vista según el rol del usuario.

    Si el usuario no está autenticado → redirige al login.
    Si está autenticado pero no tiene el rol requerido → página de acceso denegado.
    Si tiene el rol correcto → accede normalmente.
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):

            # 1. ¿Está autenticado?
            if not request.user.is_authenticated:
                messages.warning(request, 'Debes iniciar sesión para acceder.')
                return redirect('login')
            
            # 2. ¿Tiene el rol necesario?
            print(f"ROL: '{request.user.rol}' | PERMITIDOS: {roles_permitidos}")
            if request.user.rol not in roles_permitidos:
                return redirect('acceso_denegado')

            """# 2. ¿Tiene el rol necesario?
            if request.user.rol not in roles_permitidos:
                # Redirigir a página de acceso denegado
                return redirect('acceso_denegado')"""

            # 3. Todo ok → ejecutar la vista
            return view_func(request, *args, **kwargs)

        return wrapper
    return decorator
