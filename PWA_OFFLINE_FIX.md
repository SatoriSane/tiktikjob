# Problema: PWA no funciona offline en iPhone

## ¿Qué está pasando?

El Service Worker no está cacheando correctamente los archivos. Esto puede ocurrir por varias razones:

1. **iOS Safari requiere HTTPS** para que el Service Worker funcione completamente (excepto en localhost)
2. **El cache inicial falló** porque el servidor HTTP simple no estaba disponible cuando se instaló
3. **El Service Worker no se registró correctamente** en la primera visita

## Solución paso a paso

### Paso 1: Verificar que el Service Worker esté activo

En Safari del iPhone:
1. Ve a **Ajustes > Safari > Avanzado > Datos de sitios web**
2. Busca la IP de tu servidor (192.168.1.10)
3. Si aparece, elimínalo para empezar limpio

### Paso 2: Reinstalar la PWA correctamente

1. **Elimina la app** del iPhone (mantén presionado el icono > Eliminar app)
2. **Asegúrate que el servidor esté corriendo** en tu PC
3. Abre Safari y ve a `http://192.168.1.10:8080`
4. **Espera 5-10 segundos** para que el Service Worker se registre y cachee todo
5. Verifica en la consola de Safari (si tienes Mac) que no hay errores
6. Ahora sí: **Compartir > Añadir a pantalla de inicio**

### Paso 3: Probar offline

1. Abre la app desde la pantalla de inicio
2. Activa **Modo avión** en el iPhone
3. La app debería funcionar

## Solución permanente: Desplegar con HTTPS

Para que funcione 100% offline en iPhone, necesitas servir la app con HTTPS. Opciones:

### Opción A: Usar Netlify (gratis, recomendado)
```bash
# Desde tu PC, en el directorio del proyecto
npx netlify-cli deploy --prod --dir=.
```

### Opción B: Usar GitHub Pages (gratis)
1. Sube el proyecto a un repositorio de GitHub
2. Activa GitHub Pages en Settings > Pages
3. Accede desde `https://tuusuario.github.io/tic-tic-job`

### Opción C: Servidor local con HTTPS (temporal)
```bash
# Instalar mkcert para certificados locales
sudo apt install mkcert
mkcert -install
mkcert 192.168.1.10

# Usar un servidor con HTTPS
npx serve -l 8080 --ssl-cert 192.168.1.10.pem --ssl-key 192.168.1.10-key.pem
```

## Nota importante sobre iOS

Safari en iOS tiene restricciones adicionales para PWAs:
- **Requiere HTTPS** para Service Workers (excepto localhost/127.0.0.1)
- El cache puede tardar en activarse la primera vez
- Si la app se cierra completamente, iOS puede limpiar el cache después de unas semanas de inactividad

## Recomendación final

**Despliega en Netlify o GitHub Pages** para tener una URL HTTPS permanente. Es gratis y garantiza que la PWA funcione offline correctamente en cualquier dispositivo.
