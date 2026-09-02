# Fase 7A - Participantes y mensajes

Fecha: 1 de septiembre de 2026

## Objetivo

Convertir el contenedor de conversacion comercial en un canal interno
utilizable por compradores, vendedores y WalZ One Central. Este tramo
todavia no incorpora interfaz web ni conexiones con redes externas.

## Participantes

Tabla: `conversation_participants`

- cada usuario aparece una sola vez por conversacion;
- los roles disponibles son `BUYER`, `SELLER`, `ADMIN` y `MEMBER`;
- `is_active` permite retirar acceso sin borrar el historial;
- `joined_at` registra el ingreso;
- `last_read_at` registra la ultima lectura conocida.

Al crear una conversacion se incorporan automaticamente:

- quien la inicia;
- el propietario de la tienda;
- el comprador, cuando existe un pedido relacionado.

WalZ One Central puede abrir cualquier conversacion. Si interviene o
marca la conversacion como leida, queda registrado como participante
con rol `ADMIN`.

Las conversaciones creadas antes de este sprint siguen siendo
accesibles mediante las reglas originales de creador, tienda y pedido.
El participante explicito se crea al enviar un mensaje o marcar la
lectura.

## Mensajes

Tabla: `conversation_messages`

- `conversation_id`: conversacion a la que pertenece;
- `sender_id`: usuario que lo envio;
- `message_type`: `TEXT` o `SYSTEM`;
- `body`: contenido, con un maximo de 4000 caracteres;
- `created_at` y `updated_at`: fechas de auditoria.

En esta etapa los usuarios crean mensajes `TEXT`. `SYSTEM` queda
reservado para futuros eventos automaticos. Los mensajes se devuelven
en orden cronologico y no pueden enviarse cuando la conversacion esta
cerrada o archivada.

## Privacidad y acceso

- un participante activo puede abrir la conversacion;
- comprador, vendedor y creador mantienen compatibilidad de acceso si
  la conversacion todavia no posee su participante explicito;
- un participante desactivado no recupera acceso por las reglas de
  compatibilidad;
- un usuario ajeno no puede abrir, leer ni enviar mensajes;
- un administrador puede intervenir para soporte y resolucion de
  problemas.

## API

Todas las rutas requieren una sesion autenticada.

- `GET /conversations/{id}/participants`: listar participantes.
- `POST /conversations/{id}/messages`: enviar un mensaje.
- `GET /conversations/{id}/messages`: listar mensajes con paginacion.
- `PATCH /conversations/{id}/read`: marcar como leida.
- `PATCH /conversations/{id}/status`: cerrar, reabrir o archivar.
- `GET /conversations/unread/count`: obtener el total de mensajes no
  leidos accesibles para la cuenta.

Estas rutas complementan la creacion, el listado y la apertura de
conversaciones del sprint anterior.

Un participante activo puede cerrar o reabrir. Archivar y recuperar
una conversacion archivada queda reservado al vendedor de la tienda y
a WalZ One Central.

## Validaciones realizadas

La prueba SQLite temporal comprobo:

- creacion automatica de comprador y vendedor como participantes;
- envio y orden cronologico de mensajes;
- normalizacion del contenido;
- acceso de comprador, vendedor y administrador;
- rechazo de un usuario externo;
- incorporacion de WalZ One Central al intervenir;
- registro de lectura;
- retiro de acceso a un participante desactivado;
- bloqueo de mensajes en una conversacion cerrada;
- creacion correcta de las tres tablas de conversacion.

La prueba no modifico `walz_local.db`.

## Fuera de alcance

- adjuntos, imagenes y audios;
- contador de no leidos y confirmacion por mensaje;
- edicion o eliminacion de mensajes;
- cierre y archivo desde la interfaz;
- notificaciones en tiempo real;
- interfaz web conversacional;
- WhatsApp, Instagram, Facebook o email;
- respuestas automaticas o asistencia con inteligencia artificial.

## Proximo tramo

Construir la primera interfaz interna responsive:

1. bandeja de conversaciones;
2. vista de mensajes;
3. compositor de texto;
4. contexto visible de tienda, producto o pedido;
5. estado vacio, carga y errores;
6. indicador basico de no leidos.
