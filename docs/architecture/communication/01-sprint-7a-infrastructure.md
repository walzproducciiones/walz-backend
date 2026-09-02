# Fase 7A - Infraestructura de conversaciones comerciales

Fecha: 1 de septiembre de 2026

## Objetivo

Incorporar el contenedor inicial del Sistema de Conversaciones
Comerciales sin agregar todavia mensajes, archivos, frontend ni
integraciones externas.

Este sprint implementa el nucleo interno definido en
`00-vision-omnichannel.md`. Las integraciones externas forman parte
de la vision del proyecto, pero se incorporaran por etapas sobre una
base interna estable.

## Modelo

Tabla: `conversations`

- `id`: identificador UUID.
- `store_id`: tienda a la que pertenece la conversacion.
- `product_id`: producto relacionado, opcional.
- `order_id`: pedido relacionado, opcional.
- `created_by`: usuario que inicio la conversacion.
- `subject`: asunto comercial breve.
- `status`: `OPEN`, `CLOSED` o `ARCHIVED`.
- `created_at` y `updated_at`: fechas de auditoria.

La conversacion es el contenedor. Los mensajes se incorporaran en
un sprint posterior como contenido de ese contenedor.

## Reglas de coherencia

- La tienda debe existir y estar activa.
- Un producto relacionado debe estar activo, no eliminado y
  pertenecer al propietario de la tienda seleccionada.
- Un pedido relacionado debe pertenecer a la tienda seleccionada.
- Si se indican producto y pedido, el producto debe formar parte
  de ese pedido.
- Solo el comprador del pedido, el propietario de la tienda o un
  administrador pueden asociar un pedido a una conversacion.
- El asunto se normaliza antes de guardarlo y admite entre 2 y 200
  caracteres.

## Acceso

Una conversacion puede ser consultada por:

- el usuario que la inicio;
- el propietario de la tienda;
- el comprador del pedido relacionado;
- un administrador de WalZ One.

En este sprint no existe todavia una tabla explicita de
participantes. La participacion se determina con el creador, la
tienda y el pedido relacionado.

## API

Todas las rutas requieren una sesion autenticada.

- `POST /conversations`: crear una conversacion.
- `GET /conversations`: listar las conversaciones accesibles para
  el usuario. Admite `status`, `limit` y `offset`.
- `GET /conversations/{conversation_id}`: abrir una conversacion
  accesible para el usuario.

## Integracion de base

El modelo se importa en `backend/app/main.py` antes de ejecutar
`Base.metadata.create_all`. Al tratarse de una tabla nueva, no fue
necesario agregar una alteracion incremental a
`schema_updates.py`.

## Validaciones realizadas

- Sintaxis Python validada en los cinco archivos involucrados.
- Tabla creada correctamente en una SQLite temporal.
- Creacion de conversacion validada con producto y pedido.
- Normalizacion del asunto y estado inicial `OPEN` validados.
- Listado y apertura validados para comprador, vendedor y
  administrador.
- Privacidad validada para un usuario ajeno.
- Rechazo de producto perteneciente a otra tienda validado.
- Rechazo de pedido ajeno validado.
- Espacios y formato validados con `git diff --check`.

La prueba no modifico `walz_local.db`.

## Fuera de alcance de este sprint

- mensajes;
- adjuntos;
- indicadores de lectura;
- cierre o archivo desde la API;
- notificaciones;
- interfaz web;
- WhatsApp, Instagram, Facebook o email;
- automatizaciones o respuestas con inteligencia artificial.

Estos puntos no se descartan. Se mantienen planificados en la vision
omnicanal y se implementaran en sprints posteriores.

## Proximo sprint

Disenar e implementar el contenido de las conversaciones:

1. participantes explicitos;
2. modelo de mensaje;
3. autorizacion de remitentes;
4. envio y listado cronologico;
5. lectura y estados basicos;
6. pruebas SQLite;
7. recien despues, interfaz conversacional.
