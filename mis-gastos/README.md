# Mis gastos

App sencilla para organizar los gastos del mes, pensada para una persona mayor: letra grande, botones grandes y teclado normal del celular.

## Qué hace

- Inicio: contador de lo gastado en el mes y los últimos gastos.
- Agregar un gasto: monto y qué compró; la fecha se pone sola. Tiene su propio teclado dentro de la app (no abre el del celular).
- Recibos: luz, agua, gas y teléfono, comparados con el mes pasado (verde = gastó menos, rojo = gastó más).
- Historial: por día, por mes y por año.
- Animaciones: contador que sube, lluvia de monedas y estrellas al guardar, rebote en las pestañas. No usa sonidos.

Los datos se guardan solo en el celular. Si se desinstala la app, se borran.

## Cómo obtener el APK

1. Crea un repositorio nuevo en GitHub y sube todo el contenido de esta carpeta (incluida `.github`).
2. Entra a la pestaña **Actions**. El workflow "Compilar APK" corre solo con cada subida a `main` (o dale "Run workflow").
3. Cuando termine (unos 5 a 10 minutos), abre la ejecución y descarga `mis-gastos-apk` en la sección **Artifacts**.
4. Para tener el APK en **Releases**, crea una etiqueta:

   ```
   git tag v1.0.0
   git push origin v1.0.0
   ```

## Instalar en el celular

1. Pasa `mis-gastos.apk` al celular (WhatsApp, Drive, cable).
2. Ábrelo y permite "instalar apps de orígenes desconocidos" cuando Android lo pida.

Es un APK de prueba (debug), suficiente para instalar a mano. Para publicar en Play Store haría falta firmarlo.

## Probar en la computadora

Abre `www/index.html` en el navegador.
