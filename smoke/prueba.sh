#!/usr/bin/env bash
# Prueba de notificaciones en un Android simulado (se corre dentro de GitHub Actions).
# - Sin internet en el celular simulado: la prueba NO toca los datos reales de Firebase.
# - Instala el APK, abre la app, acepta el permiso de notificaciones como lo haría una persona,
#   adelanta el reloj a las 21:59 y comprueba que a las 22:00 sale el recordatorio.
PKG=com.misgastos.app
OUT=salida
fail=0
mkdir -p $OUT
ok()  { echo "OK    $1"; }
bad() { echo "FALLA $1"; fail=1; }

adb wait-for-device
adb root >/dev/null 2>&1; sleep 3; adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ]; do sleep 2; done

echo "== celular: $(adb shell getprop ro.product.model | tr -d '\r'), Android $(adb shell getprop ro.build.version.release | tr -d '\r')"
adb shell cmd connectivity airplane-mode enable >/dev/null 2>&1 || adb shell settings put global airplane_mode_on 1
sleep 3
if adb shell ping -c1 -W2 8.8.8.8 >/dev/null 2>&1; then echo "AVISO: el celular simulado todavía tiene internet"; else ok "celular simulado sin internet (no se tocan los datos reales)"; fi

adb shell settings put global auto_time 0
adb shell settings put global auto_time_zone 0
DIA=$(date -u +%Y-%m-%d)
adb shell "date -s '$DIA 21:50:00'" >/dev/null
echo "hora del celular simulado: $(adb shell date | tr -d '\r')"

adb install -r mis-gastos.apk | tail -1
adb shell am start -n $PKG/.MainActivity >/dev/null

# Aceptar los permisos que pide la app, igual que una persona tocando "Permitir"
toques=0
for i in $(seq 1 14); do
  adb shell uiautomator dump /sdcard/u.xml >/dev/null 2>&1
  adb pull /sdcard/u.xml $OUT/u.xml >/dev/null 2>&1
  XY=$(python3 - <<'PY'
import re
x=open('salida/u.xml',encoding='utf-8',errors='ignore').read()
m=re.search(r'permission_allow_button"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',x)
print(f"{(int(m.group(1))+int(m.group(3)))//2} {(int(m.group(2))+int(m.group(4)))//2}" if m else "")
PY
)
  if [ -n "$XY" ]; then adb shell input tap $XY; toques=$((toques+1)); echo "toqué Permitir ($XY)"; sleep 3
  else [ $i -gt 5 ] && [ $toques -gt 0 ] && break; sleep 3; fi
done
adb exec-out screencap -p > $OUT/1_app_abierta.png
[ $toques -gt 0 ] && ok "la app pidió permiso de notificaciones y se aceptó ($toques vez/veces)" || echo "AVISO: no apareció pantalla de permiso (puede venir ya concedido)"
sleep 10

echo "== permisos concedidos a la app"
adb shell dumpsys package $PKG | grep -E "POST_NOTIFICATIONS|USE_EXACT_ALARM|SCHEDULE_EXACT_ALARM|RECEIVE_BOOT" | head -8
adb shell dumpsys package $PKG | grep -q "POST_NOTIFICATIONS: granted=true" && ok "permiso de notificaciones concedido" || bad "permiso de notificaciones NO concedido"
adb shell dumpsys package $PKG | grep -q "USE_EXACT_ALARM: granted=true" && ok "permiso de alarmas exactas concedido solo (no hay que activar nada)" || bad "alarmas exactas NO concedidas"

echo "== alarmas de la app"
adb shell dumpsys alarm | grep -i -B1 -A3 "$PKG" | head -30
N=$(adb shell dumpsys alarm | grep -c "$PKG")
[ "$N" -gt 0 ] && ok "hay una alarma programada de la app" || bad "no hay ninguna alarma programada de la app"

echo "== revisor en segundo plano (WorkManager)"
adb shell dumpsys jobscheduler | grep -i "$PKG" | head -5
adb shell dumpsys jobscheduler | grep -i "$PKG" | grep -q "SystemJobService" && ok "el revisor del recibo del teléfono está programado en el sistema" || bad "el revisor del recibo NO está programado"

echo "== aviso del recibo (se dispara el mismo aviso desde el revisor de segundo plano)"
PID=$(adb shell pidof $PKG | tr -d '\r')
adb forward tcp:9222 localabstract:webview_devtools_remote_$PID >/dev/null
node smoke/cdp.js 9222 "window.Capacitor.Plugins.BackgroundRunner.dispatchEvent({label:'com.misgastos.app.check',event:'probarAviso',details:{}}).then(function(){return 'enviado'})" && ok "el revisor ejecutó su código" || bad "el revisor no pudo ejecutar su código"
sleep 8
adb shell dumpsys notification --noredact > $OUT/notificaciones_1.txt
if grep -q "Recibo del Tel" $OUT/notificaciones_1.txt; then ok "salió la notificación: Recibo del Teléfono fue pagado"; else bad "NO salió la notificación del recibo"; fi

echo "== recordatorio diario de las 22:00"
adb shell "date -s '$DIA 21:59:40'" >/dev/null
echo "hora del celular simulado: $(adb shell date | tr -d '\r')"
sleep 40
echo "hora del celular simulado: $(adb shell date | tr -d '\r')"
adb shell dumpsys notification --noredact > $OUT/notificaciones_2.txt
grep -E "android.title=|android.text=" $OUT/notificaciones_2.txt | grep -i -E "registraste|Mis gastos" | head -6
if grep -q "registraste tus gastos de hoy" $OUT/notificaciones_2.txt && grep -q "Organ" $OUT/notificaciones_2.txt; then ok "salió el recordatorio: ¿Ya registraste tus gastos de hoy? ¡Organízate!"; else bad "NO salió el recordatorio de las 22:00"; fi
adb shell cmd statusbar expand-notifications; sleep 2
adb exec-out screencap -p > $OUT/2_notificaciones.png

echo "== ¿se repite al día siguiente?"
SIG=$(date -u -d "$DIA + 1 day" +%Y-%m-%d)
echo "alarma pendiente de la app:"
adb shell dumpsys alarm | grep -A1 "$PKG}" | grep -o "origWhen=[0-9-]* [0-9:]*" | sort -u
# (la lista de alarmas del sistema cambia de formato según la versión; lo que vale es la prueba directa de abajo)
adb shell "date -s '$SIG 21:59:40'" >/dev/null
sleep 40
echo "hora del celular simulado: $(adb shell date | tr -d '\r')"
adb shell dumpsys notification --noredact > $OUT/notificaciones_3.txt
CUANDO=$(python3 - <<'PY'
import re,datetime
t=open('salida/notificaciones_3.txt',encoding='utf-8',errors='ignore').read()
m=re.search(r'\|22\|null\|.*?\bwhen=(\d+)',t,re.S)
print(datetime.datetime.fromtimestamp(int(m.group(1))/1000,datetime.timezone.utc).strftime('%Y-%m-%d %H:%M') if m else '')
PY
)
echo "el recordatorio salió por última vez: $CUANDO (UTC)"
[ "${CUANDO%% *}" = "$SIG" ] && ok "al día siguiente ($SIG) volvió a sonar a las 22:00: es diario" || bad "al día siguiente NO volvió a sonar"

adb logcat -d | grep -i -E "misgastos|BackgroundRunner|Capacitor/|LocalNotif" | tail -60 > $OUT/registro.txt
echo; [ $fail -eq 0 ] && echo "TODO BIEN" || echo "HUBO FALLAS"
exit $fail
