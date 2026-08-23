# accounts/migrations/0002_usuariopersonalizado_fecha_baja.py
#
# Esta migración agrega el campo `fecha_baja` al modelo UsuarioPersonalizado.
# Ejecutar con:  python manage.py migrate
#

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        # La migración anterior del proyecto
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='usuariopersonalizado',
            name='fecha_baja',
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name='Fecha de baja',
                help_text='Se registra automáticamente al dar de baja al usuario.'
            ),
        ),
    ]
