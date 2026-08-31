# WALZ ONE — HANDOFF MAESTRO

**Actualizado:** 31/08/2026
**Objetivo:** permitir continuar WalZ One en un chat nuevo sin reconstruir el proyecto desde conversaciones antiguas.

---

# 1. REGLA DE ORO DE CONTINUIDAD

La fuente de verdad de WalZ One es, en este orden:

1. Código actual en `C:\Users\Usuario\walz`
2. Estado real de Git
3. Base de datos actual
4. Último commit validado
5. Último checkpoint / backup
6. Este `WALZ-HANDOFF-MAESTRO.md`
7. Chat actual
8. Chats anteriores solamente como archivo histórico

## PROHIBIDO

- No reconstruir código desde WalZ One 1, 2, 3, etc.
- No copiar código viejo de un chat anterior sobre la arquitectura actual.
- No asumir que una solución antigua sigue siendo válida.
- No rehacer módulos cerrados salvo que exista un bug real comprobado.
- No continuar desde recuerdos si Git o el código actual dicen otra cosa.

Los chats anteriores pueden consultarse para recuperar:
- razones de una decisión;
- ideas pendientes;
- contexto histórico.

Pero cualquier idea recuperada debe compararse primero contra el código actual.

---

# 2. METODOLOGÍA DE TRABAJO CON CARLOS

## Método normal

- Trabajar un solo paso por vez.
- Dar UN comando PowerShell por vez.
- Esperar siempre el resultado antes del siguiente comando.
- Si Carlos responde `v`, significa vacío / sin salida.
- No usar `&&`.
- No hacer cambios grandes de una sola vez sin inspección previa.
- Antes de modificar, estudiar el código existente y reutilizarlo.
- Evitar hardcodear vendedores, tiendas, ciudades, marcas o rubros.
- Priorizar cambios pequeños y reversibles.
- Revisar diff antes de commit.
- Validar antes de cerrar cada bloque.
- Uvicorn debe quedar preferentemente visible en una consola aparte para ver logs.

## Secuencia recomendada de cambio

1. Inspeccionar.
2. Entender causa real.
3. Modificar lo mínimo necesario.
4. Probar.
5. `git diff --check`.
6. Revisar `git diff`.
7. `git add`.
8. `git diff --cached --check`.
9. Commit.
10. Confirmar Git limpio.
11. Crear checkpoint si el bloque es importante.

---

# 3. METODOLOGÍA DE CAMBIO DE CHAT

Cuando un chat se vuelva largo o Carlos quiera cerrarlo:

1. Terminar o detener limpiamente el bloque actual.
2. Verificar `git status`.
3. Hacer commit si corresponde.
4. Confirmar Git limpio.
5. Crear backup/checkpoint.
6. Actualizar este `WALZ-HANDOFF-MAESTRO.md`.
7. Registrar Lista Maestra actual.
8. Registrar qué quedó pendiente.
9. Registrar próximo paso exacto.
10. Abrir el chat siguiente usando este archivo como handoff.

El chat cerrado pasa a ser HISTÓRICO.

El nuevo chat NO debe comenzar programando inmediatamente.

Primero debe:
- leer este handoff;
- verificar `git status`;
- verificar `git log -1`;
- comprobar que coincide con el estado documentado;
- recién después continuar.

---

# 4. USO DE CODEX

Codex no decide qué construir en WalZ One.

La metodología acordada es:

1. Carlos y ChatGPT analizan y deciden aquí la tarea.
2. Se determina si realmente conviene usar Codex.
3. ChatGPT prepara un prompt preciso para Codex.
4. Codex recibe una tarea delimitada.
5. Codex no debe hacer refactors generales ni cambios fuera de alcance.
6. Al terminar, Carlos vuelve con resultado/diff/pruebas.
7. ChatGPT y Carlos revisan antes de incorporar el cambio estable.

Codex debe utilizarse especialmente cuando ahorre trabajo importante:
- revisión de muchos archivos;
- implementación acotada pero extensa;
- tests;
- tareas repetitivas;
- análisis de código amplio.

No gastar Codex para cambios pequeños que pueden resolverse aquí de forma controlada.

En el futuro conviene crear también `AGENTS.md` con reglas estructurales permanentes para Codex.

---

# 5. ENTORNO ACTUAL

## Desarrollo local

Ruta:

`C:\Users\Usuario\walz`

Entorno virtual:

`venv`

Servidor habitual:

`uvicorn backend.app.main:app --host 127.0.0.1 --port 8002 --reload`

URL local:

`http://127.0.0.1:8002`

Carlos prefiere Uvicorn visible en una consola separada.

## Git

Rama de trabajo actual:

`feature/portada-exploracion`

Último commit FUNCIONAL confirmado antes del Handoff:

`7c055b2 - fix: habilitar busqueda en marketplace central y vendedores`

El HEAD exacto de cierre no se hardcodea en este archivo porque este Handoff también está versionado. Debe obtenerse siempre con `git log -1 --oneline --decorate` y contrastarse con el último checkpoint.

Git:

LIMPIO al cierre de este handoff.

---

# 6. ÚLTIMOS COMMITS ECONÓMICOS IMPORTANTES

3A:
`a3b50e5`
Pedido <-> Pago / cancelación.

3B:
`e95198b`
Configuración económica + snapshot inmutable por pedido.

3C:
`8a34cb5`
Libro económico transaccional.

3D:
`e6a3095`
Economía WalZ One Central.

3E:
`80b5036`
Cuenta económica y liquidaciones por vendedor.

Último commit funcional:
`7c055b2`
Buscador habilitado en WalZ One Central y marketplaces de vendedores.

---

# 7. ÚLTIMO CAMBIO VALIDADO — BUSCADOR

Problema:

En WalZ One Central se podía escribir en `#product-search`, pero:
- Enter no hacía nada.
- La lupa no hacía nada.

Causa:

`renderSellerMarketplaceClassification(...)` entraba en:

`if (!isSellerMarketplace)`

para WalZ One Central y ejecutaba `return` antes de enlazar los eventos del buscador.

Solución:

Se enlazó el buscador Central ANTES de ese `return`.

Se reutiliza:

`executeSellerMarketplaceSearch()`

y la lógica existente:

`filterProducts()`

No se creó una segunda búsqueda.

Validado manualmente:

WalZ One Central:
- texto: OK
- Enter: OK
- lupa: OK

Marketplaces de vendedores:
- texto: OK
- Enter: OK
- lupa: OK

---

# 8. ÚLTIMO CHECKPOINT

Ruta:

`C:\Users\Usuario\Documents\WalZ-One-Backups\CIERRE-BUSCADOR-2026-08-31-0400`

Archivos:

- `CHECKPOINT-Y-HANDOFF.txt`
- `GIT-LOG.txt`
- `GIT-STATUS.txt`
- `WALZ-ONE-CODIGO-2026-08-31-0400.zip`
- `WALZ-ONE-GIT-HISTORY-2026-08-31-0400.bundle`
- `walz_local-2026-08-31-0400.db`

Validaciones:

- SQLite integrity_check: OK
- Git bundle: historia completa / verify OK
- ZIP: 83 archivos
- Git: 83 archivos
- faltantes: 0
- extras: 0
- coincidencia: OK

Checkpoint económico anterior:

`C:\Users\Usuario\Documents\WalZ-One-Backups\CIERRE-ECONOMIA-3E-2026-08-30-1624`

---

# 9. ARQUITECTURA FUNDAMENTAL — NO ROMPER

## Plataforma

WalZ One es una plataforma MULTIVENDEDOR y escalable.

Toda función debe poder crecer a:
- 2 vendedores;
- 10 vendedores;
- 100 o más vendedores.

No hardcodear vendedores concretos.

## Navegación

Regla definitiva:

`/`
= WalZ One Central siempre.

`/farmacia-federico`
= marketplace particular de Farmacia Federico.

`/mayludstore`
= marketplace particular de Maylud Store.

Un vendedor logueado NO transforma `/` en su tienda.

## Roles

Roles principales:

- COMPRADOR
- VENDEDOR / SELLER
- ADMIN

ADMIN no es vendedor.

ADMIN:
- Administración Central;
- supervisión;
- sin carrito de comprador;
- sin funciones propias de vendedor.

VENDEDOR:
- administra su tienda;
- productos;
- ventas;
- publicidad/propuestas correspondientes;
- puede ver su tienda pública.

COMPRADOR:
- explora;
- carrito;
- compra.

---

# 10. PUBLICIDAD — REGLAS

Publicidad WalZ One Central y publicidad/propuestas de vendedores son INVENTARIOS SEPARADOS.

No mezclarlas automáticamente.

Dentro de una tienda directa:
- no mostrar publicidad de competidores;
- no invadir la experiencia;
- evitar popups molestos.

WalZ One Central necesita espacios publicitarios propios como vía económica de la plataforma.

Publicidad y Economía son módulos separados.

---

# 11. ECONOMÍA — ESTADO ACTUAL

Principio:

CONTABILIDAD PRIMERO / COBRO AUTOMÁTICO DESPUÉS.

Actualmente el comprador paga al vendedor/tienda.

WalZ One no recibe actualmente el total de la venta para luego pagar el neto al vendedor.

## 3E

La cuenta económica representa:

comisiones devengadas
- reversos
- pagos de comisión registrados
= saldo pendiente del vendedor con WalZ One.

Tabla:

`seller_fee_settlements`

Rutas:

- GET `/economy/admin/sellers`
- GET `/economy/admin/sellers/{seller_id}`
- GET `/economy/admin/settlements`
- POST `/economy/admin/settlements`
- POST `/economy/admin/settlements/{settlement_id}/cancel`

Todo protegido para ADMIN.

## Reglas económicas

`Payment`
= pago comprador/pedido.

NO usar Payment para liquidaciones de vendedores.

`EconomicLedgerEntry`
= fuente de verdad de hechos económicos.

`SellerFeeSettlement`
= pago del vendedor a WalZ One.

No recalcular pedidos históricos.

No definir todavía una comisión final.

No activar economía transaccional sin decisión formal.

Estado al cierre de 3E:

- economía habilitada: NO
- comisión definitiva: NO DEFINIDA
- movimientos económicos reales: 0
- seller_fee_settlements: 0
- deudas ficticias: 0

---

# 12. FARMACIA FEDERICO

Tienda piloto real.

Slug:

`farmacia-federico`

Reglas conocidas:

- retiro en local habilitado;
- envío a domicilio deshabilitado en la configuración validada;
- AvanTer habilitado;
- identidad propia;
- portada particular separada de Central.

Actualmente muchos productos/datos del catálogo local son DE PRUEBA.

Al cierre de WalZ One 18:
- 30 productos activos de prueba;
- solo 1 tenía imagen;
- no deben presentarse como catálogo comercial real.

Pendiente recibir listado real e imágenes reales.

No invertir tiempo en embellecer datos ficticios antes de recibir material real.

---

# 13. MAYLUD STORE

Tienda piloto real de tipo polirrubro.

Slug:

`mayludstore`

Al cierre de WalZ One 18:

- 1 producto activo;
- producto actual de prueba/demo;
- pendiente recibir productos reales de Mayra.

No recuperar productos históricos descartados como catálogo real.

La tienda sirve como segundo piloto para probar multivendedor y multirrubro.

---

# 14. AVANTER

AvanTer debe permanecer separado de:

Rubro -> Subrubro -> Marca.

Estado actual básico:

- tiendas pueden estar adheridas;
- productos pueden tener `avanter_enabled`;
- Farmacia Federico tiene soporte de AvanTer.

Evolución futura registrada en Lista Maestra:

Programa
-> tienda adherida
-> laboratorio/marca
-> proveedor/canal
-> estado de adhesión
-> productos asociados.

Reglas futuras:

- no hardcodear marcas/proveedores;
- una marca puede tener varios proveedores;
- Central controla adhesión;
- mantener historial cuando se implemente versión completa;
- no guardar credenciales AvanTer en código/repositorio/handoff.

---

# 15. TAXONOMÍA

La taxonomía debe ser dinámica y multivendedor.

No depender exclusivamente de creación manual por Administración Central.

Estructura conceptual:

Macro-rubro
-> Rubro
-> Subrubro / etiquetas

Los rubros pueden mostrarse aunque todavía no tengan comercios:
ej. “Próximamente” / “Sumando comercios”.

---

# 16. HORARIOS DE TIENDA — PENDIENTE

Todas las tiendas deben poder configurar horarios estructurados.

Debe contemplar:

- horarios por día;
- cerrado;
- más de una franja por día;
- excepciones;
- fechas especiales.

Farmacias además deberán soportar información específica de guardias.

No hardcodear rubros ni ciudades.

---

# 17. REDES Y PUBLICACIÓN MULTICANAL — LISTA MAESTRA

Objetivo:

Cargar/publicar una vez en WalZ One y reutilizar hacia:

- WhatsApp
- Facebook
- Instagram
- otros canales futuros

Estado anterior validado:

- carga rápida desde WhatsApp: validada;
- compartir por WhatsApp: validado;
- compartir por Facebook: validado;
- copiar publicación e imagen: disponible;
- Instagram: acceso asistido actualmente.

Pendiente:

automatización multicanal más profunda.

No abrir este bloque automáticamente al iniciar el próximo chat.

Primero verificar prioridad.

---

# 18. CONVERSACIÓN / OMNICANALIDAD — LISTA MAESTRA

Pendiente importante y de alta complejidad.

Objetivo futuro:

conectar conversaciones iniciadas fuera de WalZ One, como WhatsApp o redes, con:

- conversación comercial;
- producto;
- carrito;
- pedido;
- compra.

Mantener separado de publicidad externa de vendedores.

También queda pendiente un posible chat interno comprador <-> vendedor.

No construirlo apresuradamente.

---

# 19. AUTOMATIZACIÓN DE PUBLICACIONES — LISTA MAESTRA

Necesidad real detectada:

reducir trabajo manual del vendedor al recibir material desde múltiples grupos/canales.

Objetivo:

- seleccionar productos;
- preparar fotos;
- adaptar descripción;
- asignar precio;
- reutilizar contenido;
- publicar/distribuir.

Debe integrarse en el futuro con el flujo multicanal.

---

# 20. AYUDA OPERATIVA — LISTA MAESTRA

## Vendedores

Ayuda contextual cerca de formularios y acciones para:

- productos;
- imágenes;
- descripciones;
- precios;
- stock;
- promociones;
- pagos;
- entregas;
- publicidad.

## Administración

Centro de ayuda:

- preguntas frecuentes;
- búsqueda por tema;
- soluciones repetidas;
- futura edición de contenido sin modificar código.

---

# 21. TIENDAS / PRODUCTOS / COMPRAS

Ya existe estructura funcional para:

- productos;
- stock;
- imágenes;
- categorías;
- subcategorías;
- marcas;
- propuestas comerciales;
- carrito;
- checkout;
- pedidos;
- compras;
- ventas;
- entrega/retiro;
- pagos;
- administración.

Soft delete de productos existente.

Propuestas comerciales soportadas:

- OFERTA
- PROMOCION
- NOVEDAD
- COMBO
- 2X1
- LIQUIDACION
- BENEFICIO

No rehacer estas bases salvo bug comprobado.

---

# 22. ADMINISTRACIÓN CENTRAL

ADMIN dispone de Administración Central.

Áreas desarrolladas incluyen, entre otras:

- solicitudes de vendedores;
- tiendas;
- pedidos;
- productos;
- publicidad Central;
- configuración institucional;
- Economía Central.

La administración debe escalar a muchos vendedores.

Para listados grandes:
priorizar búsqueda/paginación del lado servidor cuando corresponda.

---

# 23. DATOS REALES VS DATOS DE PRUEBA

Regla importante:

No confundir un flujo funcional validado con datos comerciales reales.

Actualmente parte importante del catálogo local de los pilotos contiene datos ficticios/de prueba.

Cuando lleguen datos reales:

1. revisar;
2. cargar algunos productos representativos;
3. probar;
4. recién luego reemplazar masivamente contenido ficticio.

No inventar productos, precios o imágenes para aparentar producción real.

---

# 24. LOCAL / GITHUB / RENDER — ESTRATEGIA ACORDADA

## Desarrollo

Continuar localmente como entorno principal de trabajo.

## GitHub

Debe transformarse en respaldo remoto principal del código y punto común futuro para trabajo externo/Codex.

Antes de usar el remoto como fuente actual:
verificar su estado real contra el Git local.

## Render

Render es despliegue, NO backup principal.

Objetivo futuro:

LOCAL
-> Git/GitHub privado
-> rama estable
-> Render

Separar:

LOCAL = desarrollo

ONLINE = versión estable

No desplegar automáticamente cada experimento.

## Base online

SQLite local sirve para desarrollo actual.

Producción multivendedor deberá utilizar PostgreSQL persistente.

No asumir que `walz_local.db` será base definitiva de producción.

---

# 25. LISTA MAESTRA — GRANDES BLOQUES PENDIENTES

Mantener en lista, sin asumir orden automático:

- datos/productos/imágenes reales de pilotos;
- horarios estructurados de tiendas;
- guardias de farmacias;
- evolución completa de AvanTer;
- publicación multicanal;
- automatización de publicaciones;
- conversación interna;
- conversación externa / omnicanal;
- ayuda contextual vendedores;
- Centro de Ayuda Administración;
- evolución económica futura;
- cobro automático futuro;
- logística / distribución futura;
- pruebas de escalabilidad;
- migración/uso estable de PostgreSQL online;
- estrategia GitHub -> Render;
- estabilización móvil;
- revisión general de UX;
- tests adicionales;
- seguridad y observabilidad para producción.

No interpretar esta lista como orden de ejecución.

El orden se decide entre Carlos y ChatGPT según prioridad real.

---

# 26. PUNTO EXACTO AL CERRAR WALZ ONE 18

Último desarrollo terminado:

BUSCADOR CENTRAL + VENDEDORES.

Último commit funcional:

`7c055b2`

El HEAD exacto final queda registrado por Git y por el checkpoint de cierre.

Git:

LIMPIO.

Último checkpoint:

`CIERRE-BUSCADOR-2026-08-31-0400`

Uvicorn fue reiniciado después de reiniciar la PC y quedó operativo en puerto 8002.

El viaje/reunión que estaba condicionando la prioridad fue SUSPENDIDO.

Por lo tanto ya no existe obligación de priorizar demo del 03/09 sobre todo lo demás.

---

# 27. PRÓXIMO PASO PARA WALZ ONE 19

NO comenzar modificando código.

Primer paso del nuevo chat:

1. Leer este archivo.
2. Ejecutar `git status --short`.
3. Ejecutar `git log -1 --oneline --decorate`.
4. Confirmar:
   - rama `feature/portada-exploracion`;
   - que `git log -1 --oneline --decorate` informe el HEAD real más reciente;
   - que `7c055b2` permanezca en la historia como último commit funcional previo al Handoff;
   - Git limpio.
5. Confirmar último checkpoint.
6. Revisar junto con Carlos la Lista Maestra.
7. Elegir el próximo bloque conscientemente.

Pendiente operativo inmediato:

- Carlos espera recibir productos/listados/imágenes reales de los pilotos.
- No bloquear el desarrollo si todavía no llegaron.
- No inventar datos reales.

---

# 28. MENSAJE DE ARRANQUE RECOMENDADO PARA WALZ ONE 19

Continuamos WalZ One desde el último estado validado.

Usar como fuente de verdad:
1. código local actual;
2. Git;
3. `WALZ-HANDOFF-MAESTRO.md`;
4. último checkpoint.

No reconstruir desde chats anteriores.

Antes de modificar cualquier archivo:
- verificar Git;
- confirmar HEAD;
- confirmar rama;
- leer el próximo paso del Handoff Maestro.

Método de trabajo:
un solo comando PowerShell por vez y esperar resultado.

---

# 29. CIERRE

Este archivo debe actualizarse EN CADA CAMBIO DE CHAT importante.

Si existe contradicción entre este archivo y Git/código actual:
GIT + CÓDIGO ACTUAL TIENEN PRIORIDAD.

Si existe contradicción entre un chat antiguo y este handoff:
ESTE HANDOFF + GIT TIENEN PRIORIDAD.

Nunca basar la continuidad únicamente en una conversación de ChatGPT.

---

# 30. WALZ ONE 19 ? HORARIOS DE TIENDA

Punto 2 completado y validado visualmente el 31/08/2026.

Commits:

- `999a193` ? feat: agregar horarios configurables por tienda
- `f15e441` ? fix: mostrar horarios en marketplace de vendedores

Regla estructural:

- horarios disponibles para TODAS las tiendas;
- cada vendedor decide si los configura;
- no hay vendedores, rubros ni ciudades hardcodeados;
- una tienda sin horarios configurados conserva el comportamiento anterior y no muestra estado de horario;
- apertura f?sica y recepci?n de pedidos online son conceptos separados.

Funciones implementadas:

- horario habitual semanal;
- m?ltiples franjas por d?a;
- d?a cerrado;
- copiar lunes a martes-viernes;
- copiar lunes a toda la semana;
- horarios de temporada;
- temporadas recurrentes;
- fechas y excepciones especiales;
- horarios especiales;
- mensaje p?blico;
- pedidos online ALWAYS / OPEN_ONLY;
- excepci?n online ALWAYS / OPEN_ONLY / DISABLED;
- franjas nocturnas;
- c?lculo de pr?xima apertura;
- prioridad excepci?n -> temporada -> habitual;
- integraci?n con checkout;
- estado p?blico Abierto ahora / Cerrado ahora;
- pr?xima apertura;
- Ver horario habitual;
- fallas del servicio de horarios no deben impedir abrir una tienda.

Validaci?n real:

Farmacia Federico decidi? configurar sus horarios:

- lunes a viernes: 09:00?13:00 y 16:00?20:00;
- s?bado: 09:00?13:00;
- domingo: cerrado.

Validado visualmente en:

`/farmacia-federico`

La portada particular muestra correctamente el estado actual y el horario habitual.

La misma l?gica queda disponible autom?ticamente para Maylud Store y cualquier vendedor futuro que configure horarios.

Importante:

`showPublicStore()` no es la portada principal de una tienda directa.
Las rutas directas de vendedores usan:

`loadProducts()` -> `renderSellerMarketplaceClassification()`

Por eso el horario p?blico tambi?n qued? integrado all?.

Pr?ximo bloque separado:

FARMACIAS DE TURNO / GUARDIAS.

No mezclar guardias de farmacia con horarios comerciales normales.
