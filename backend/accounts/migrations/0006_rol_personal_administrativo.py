from django.db import migrations, models


def adminprincipal_a_personal_administrativo(apps, schema_editor):
    Usuario = apps.get_model('accounts', 'UsuarioPersonalizado')
    Usuario.objects.filter(rol='adminprincipal').update(rol='personal_administrativo')


def personal_administrativo_a_adminprincipal(apps, schema_editor):
    Usuario = apps.get_model('accounts', 'UsuarioPersonalizado')
    Usuario.objects.filter(rol='personal_administrativo').update(rol='adminprincipal')


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_usuariopersonalizado_ultima_actividad'),
    ]

    operations = [
        # 1) Ampliar el campo (el nuevo valor tiene 23 caracteres) y actualizar choices
        migrations.AlterField(
            model_name='usuariopersonalizado',
            name='rol',
            field=models.CharField(
                choices=[
                    ('personal_administrativo', 'Personal administrativo'),
                    ('admin', 'Administrador'),
                    ('usuariovip', 'Usuario VIP'),
                    ('usuariocomun', 'Usuario Común'),
                ],
                default='usuariocomun',
                max_length=30,
                verbose_name='Rol del usuario',
            ),
        ),
        # 2) Convertir los usuarios que ya existen en la base de datos
        migrations.RunPython(
            adminprincipal_a_personal_administrativo,
            personal_administrativo_a_adminprincipal,
        ),
    ]
