# Tablero de Carga Laboral y Proyectos - División Gestión de la Información y Comunicación Institucional (GyC)

Aplicación web institucional desarrollada para monitorear en tiempo real la cantidad de proyectos y nivel de ocupación de cada integrante del equipo de trabajo mediante la integración con **Trello**.

---

## 🎯 Características Principales

1. **Monitoreo de Nivel de Ocupación (Carga Laboral)**:
   - Semáforo visual institucional: **Sobrecarga (7+ tareas)**, **Carga Alta (5-6)**, **Moderada (3-4)** y **Disponible (0-2)**.
   - Barra de capacidad porcentual recomendada por integrante.
   - Diagnóstico automático para alertar sobre desbalance en la distribución de tareas.

2. **Tarjetas de Integrantes y Detalle de Proyectos**:
   - Tarjetas por persona con su rol, cantidad de tareas activas y proyectos finalizados.
   - Resumen de entregas con control de vencimiento (Atrasadas / Próximas a vencer).
   - Modal interactivo con listado completo de tarjetas, etiquetas, descripciones y enlace directo al tablero en Trello.

3. **Vistas Especializadas**:
   - **Vista Integrantes**: Tarjetas individuales de carga operativa y estado de ocupación.
   - **Vista Comparativa**: Matriz horizontal para comparar rápidamente la demanda de todo el equipo.
   - **Vista por Etapas**: Distribución visual Kanban de tareas según las listas del tablero.

4. **Integración con Trello (REST API & Caché Inteligente)**:
   - Conexión directa mediante **API Key** y **Token**.
   - Sistema de caché local (`cache/trello_cache.json`) para máximo rendimiento y protección contra límites de peticiones.
   - Botón de **Sincronización en Vivo** con microinteracciones táctiles.
   - Modal de configuración asistido para ingresar credenciales en 30 segundos.

---

## 🚀 Inicio Rápido

### Opción 1: Ejecución con 1 solo clic (Recomendado en Windows con XAMPP)
Haga doble clic en el archivo:
```text
iniciar_servidor.bat
```
El script detectará automáticamente PHP en `C:\xampp\php\php.exe`, iniciará el servidor en `http://localhost:8080` y abrirá el navegador.

### Opción 2: Desde terminal PowerShell / CMD
```powershell
& "C:\xampp\php\php.exe" -S localhost:8080
```
Luego ingrese en su navegador web a:
[http://localhost:8080](http://localhost:8080)

---

## 🔑 Conexión con su Tablero de Trello

El tablero oficial de la división es privado. Para sincronizar los datos en tiempo real:

1. Inicie sesión en Trello con la cuenta de la división:
   `auxiliargestiondelainformacion@gmail.com`
2. Ingrese a **[trello.com/app-key](https://trello.com/app-key)**.
3. Copie su **API Key** (clave de 32 caracteres).
4. En esa misma página, haga clic en el enlace que dice **"Token"** (en la sección de autorización manual), autorice la lectura y copie el **Token** generado (64 caracteres).
5. En la aplicación web, haga clic en el botón superior **"Ajustes API"**, pegue la clave y el token, y presione **"Guardar y Probar Conexión"**.

¡Listo! A partir de ese momento la página leerá automáticamente las listas, tarjetas, miembros y vencimientos directamente desde su tablero oficial de Trello.

---

## 📂 Estructura del Proyecto

```
mapa-proyectodetareas-gyc/
├── api/
│   ├── trello.php          # Endpoint REST de sincronización, métricas y caché
│   └── save_config.php     # Guardado seguro de credenciales desde el panel web
├── assets/
│   ├── css/
│   │   └── style.css       # Estilos institucionales, microinteracciones y diseño responsivo
│   └── js/
│       └── app.js          # Control de estados, filtros dinámicos, vistas y modales
├── cache/                  # Almacenamiento temporal de respuestas de Trello
├── config.php              # Configuración base y umbrales de ocupación
├── config.json             # Almacén de credenciales y variables locales (ignorado en git)
├── index.php               # Panel de control principal
├── iniciar_servidor.bat    # Lanzador automático para Windows / XAMPP
└── README.md               # Documentación institucional del proyecto
```
