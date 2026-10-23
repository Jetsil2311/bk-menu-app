# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Entorno de prueba (sin tocar los datos del café)

`npm run dev` usa la base de datos **real**. Para editar libremente usa el entorno de prueba,
que corre una copia local de Firestore + Auth (Firebase Emulators) en tu computadora:

| Comando | Qué hace |
|---|---|
| `npm run dev:test` | Abre la app en modo prueba → http://localhost:5173 y el visor de datos → http://127.0.0.1:4000. La primera vez prepara los datos solo. **Ctrl+C** para salir: tus cambios se guardan para la próxima vez. |
| `npm run test:reset` | Borra los datos de prueba y empieza de cero (`-- --demo` para forzar el menú de demostración). |
| `npm run test:pull` | (Opcional) Copia **de solo lectura** de la base real para probar con productos/clientes reales. Requiere `serviceAccountKey.json` (Firebase Console → Configuración → Cuentas de servicio → Generar nueva clave privada). Luego corre `npm run test:reset`. |

- Verás una etiqueta amarilla **"MODO PRUEBA · datos locales"** en todas las pantallas.
- En el login del panel usa **"Entrar como usuario de prueba"** (la cuenta existe solo en el emulador; credenciales en `.env.emulator`). Los PIN de las estaciones son los mismos de siempre.
- El modo prueba usa el proyecto `demo-bubblekaapeh`: Firebase no permite que se conecte al proyecto real, aunque haya un error.
- Los pedidos de prueba abren WhatsApp **sin destinatario** (nunca le llegan al café). Las fotos que subas van a la carpeta `test/` de Cloudinary.
- Requisitos: Firebase CLI (`npm i -g firebase-tools`) y Java 11+.
