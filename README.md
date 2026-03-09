# AISentinel Admin Server - Grupo 1 IN6BV

Este proyecto es el servidor administrativo principal desarrollado en Node.js y MongoDB para el sistema AISentinel. Representa una de las tres piezas fundamentales de la arquitectura del proyecto, trabajando en conjunto con un microservicio externo de autenticación y un motor de Inteligencia Artificial (desarrollado en Python con OpenCV) encargado de la detección facial de estudiantes y validación del uso correcto de uniformes y accesorios.

## Tecnologías Utilizadas

El sistema está construido sobre el ecosistema de JavaScript utilizando **Node.js** con el framework **Express**. La persistencia de datos se maneja mediante **MongoDB** y **Mongoose**. La comunicación en tiempo real con el motor de Inteligencia Artificial se realiza a través de **Socket.io**. Para el manejo y almacenamiento de imágenes (rostros de estudiantes y referencias de uniformes) se integra **Cloudinary**, y la generación de reportes estadísticos se logra con **PDFKit**, enviándolos posteriormente por correo mediante **Nodemailer**. La seguridad incluye **JSON Web Tokens (JWT)**, limitadores de peticiones y cabeceras configuradas con Helmet.

## Instalación y Configuración

1. Clonar el repositorio en el entorno local.
2. Ejecutar `pnpm install` para instalar todas las dependencias listadas en el `package.json`.
3. Crear un archivo `.env` en la raíz, guiándose por el esquema proporcionado en la sección de Variables de Entorno.
4. Asegurarse de tener el servicio de base de datos MongoDB en ejecución.
5. Levantar el servicio externo de AuthService para que la creación de usuarios y validación de tokens funcione correctamente.
6. Levantar el servicio de Python (IA) para habilitar la recepción de imágenes de entrenamiento vía WebSockets.
7. Ejecutar el comando `pnpm run dev` para iniciar el servidor localmente.

## Variables de Entorno (.env)

El archivo de configuración debe contener las siguientes claves para el correcto funcionamiento de todos los módulos:

```env
NODE_ENV=development
PORT=3067
URI_MONGO=mongodb://localhost:27017/DBAISentinel
JWT_SECRET=tu_secreto_aqui
JWT_ISSUER=AuthService
JWT_AUDIENCE=AuthService
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
AUTH_SERVICE_URL=http://localhost:3005
INTERNAL_API_TOKEN=tu_token_interno
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=tu_correo@gmail.com
SMTP_PASSWORD=tu_password_de_aplicacion
EMAIL_FROM=tu_correo@gmail.com
EMAIL_FROM_NAME=AISentinel
```

## Características Principales

**Funciones de Administrador y Coordinador**
El panel administrativo permite la gestión integral del alumnado y el personal. Los administradores pueden registrar nuevos coordinadores, asignándoles grados específicos. Tanto administradores como coordinadores pueden registrar estudiantes en el sistema, subiendo un mínimo de 3 fotografías por alumno; estas imágenes son enviadas inmediatamente en formato binario al servicio de Python vía WebSockets para entrenar el modelo de reconocimiento facial. De igual forma, se gestiona el catálogo de uniformes permitidos (chumpas, camisas, pantalones) enviando referencias visuales a la IA.

**Control de Inspecciones y Estadísticas**
El sistema controla el flujo de la inteligencia artificial mediante un módulo de inspecciones. Los coordinadores (en sus grados asignados) o administradores pueden "activar" o "desactivar" la inspección, lo cual notifica al servidor de Python mediante una petición HTTP para que inicie o detenga el escaneo en las cámaras. Además, el sistema recopila las incidencias detectadas y permite generar reportes estadísticos detallados (por grado, estudiante, objeto o día), exportándolos en formato PDF y enviándolos automáticamente al correo electrónico del personal que lo solicite.

## Rutas Principales (Endpoints)

| Módulo | Método | Endpoint | Descripción |
|---|---|---|---|
| **Estudiantes** | POST | `/api/v1/students/create` | Registra un estudiante y envía fotos a la IA por WebSockets |
| **Estudiantes** | GET | `/api/v1/students/get` | Lista los estudiantes registrados en el sistema |
| **Coordinadores** | POST | `/api/v1/coordinators/create` | Crea un coordinador y lo sincroniza con AuthService |
| **Uniformes** | POST | `/api/v1/uniforms/create` | Registra un uniforme y envía referencias a la IA |
| **Inspecciones** | PUT | `/api/v1/inspections/toggle/:grade` | Activa/Desactiva la cámara de detección para un grado |
| **Estadísticas** | GET | `/api/v1/statistics/students` | Obtiene el Top 10 de estudiantes con más infracciones |
| **Estadísticas** | POST | `/api/v1/statistics/grades/export` | Genera y envía un PDF con infracciones por grado |