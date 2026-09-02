# Fase 7A - Primera interfaz de conversaciones

Fecha: 1 de septiembre de 2026

## Resultado

La comunicacion interna ya cuenta con una primera interfaz responsive
para comprador, vendedor y WalZ One Central.

## Recorrido disponible

1. Una persona autenticada selecciona `Consultar` en un producto o
   `Conversar` desde una compra o venta.
2. WalZ One reutiliza la conversacion abierta de ese producto o pedido,
   o crea una nueva con su contexto comercial.
3. La seccion `Conversaciones` muestra la bandeja ordenada por
   actividad reciente.
4. Al abrir una conversacion se cargan participantes y mensajes.
5. El usuario puede enviar texto y la lectura queda registrada.
6. La vista se actualiza periodicamente mientras permanece abierta.

El vendedor no puede iniciar una consulta sobre un producto de su
propia tienda. Una persona sin sesion es dirigida al ingreso antes de
crear la conversacion.

## Interfaz

- acceso `Conversaciones` en la cabecera para cualquier cuenta activa;
- aviso en la cabecera con la cantidad total de mensajes no leidos;
- filtros para abiertas, cerradas, archivadas o todas;
- nombre de tienda, asunto, estado y fecha de actividad en la bandeja;
- mensajes diferenciados entre propios y ajenos;
- nombre y avatar de participantes, con identificacion contextual de
  comprador, vendedor y WalZ One Central;
- compositor bloqueado cuando la conversacion no esta abierta;
- controles para cerrar, reabrir y, con permiso, archivar;
- estados de carga, vacio y error;
- navegacion de bandeja a conversacion adaptada a celular.

## Validaciones realizadas

- sintaxis JavaScript validada con Node.js;
- identificadores nuevos del HTML verificados como unicos;
- sintaxis Python del backend validada;
- espacios del conjunto revisados;
- prueba SQLite del nucleo conversacional aprobada;
- sin modificaciones en `walz_local.db`.

No se realizo despliegue ni se conectaron servicios externos.

## Siguiente tramo

- notificaciones en tiempo real;
- adjuntos y notas del sistema.
