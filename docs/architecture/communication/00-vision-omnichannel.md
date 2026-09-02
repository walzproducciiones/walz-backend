# Vision omnicanal e interna de WalZ One

Fecha: 1 de septiembre de 2026

## Principio central

WalZ One debe ser el centro de la actividad comercial y
conversacional, aunque el contenido o el primer contacto nazcan en
WhatsApp, un mayorista, Facebook, Instagram u otro canal.

Las redes externas sirven para captar contenido, difundir productos
y atraer personas. WalZ One conserva el producto, la conversacion,
la compra, la venta y la experiencia comercial completa.

WalZ One Central tambien utiliza el mismo principio para difundir
su propio trabajo: novedades de la plataforma, nuevos vendedores,
campanas institucionales, contenidos de ayuda, rubros y experiencias
destacadas.

## Dos flujos diferentes

### 1. Contenido y publicaciones

Este flujo resuelve el caso de Maylud Store y otros vendedores que
reciben productos, fotos o listas desde grupos de WhatsApp y
mayoristas.

```text
WhatsApp / mayorista / archivo / enlace
                    |
                    v
          Bandeja de material recibido
                    |
                    v
        Borrador pendiente de revision
                    |
                    v
     Precio + stock + imagen + descripcion
                    |
                    v
          Publicacion en WalZ One
                    |
                    v
 WhatsApp / Facebook / Instagram / otros
```

Un mensaje recibido nunca debe convertirse automaticamente en un
producto publicado. Primero debe pasar por una revision del vendedor
para confirmar:

- origen y mayorista;
- autorizacion para utilizar fotos y textos;
- precio de venta;
- stock o disponibilidad;
- vigencia de la oferta;
- tienda, rubro y clasificacion;
- imagen y descripcion definitivas.

La primera implementacion puede ser asistida: pegar texto, compartir
una imagen o importar una planilla. Las conexiones automaticas se
incorporaran solamente cuando las APIs oficiales, permisos y reglas
de cada canal lo permitan.

### 2. Conversaciones y comercio

Este flujo conecta a compradores, vendedores y WalZ One Central.

```text
Consulta externa o interna
            |
            v
 Conversacion comercial en WalZ One
            |
            +--> producto
            +--> tienda
            +--> pedido
            +--> compra / venta
            +--> entrega / postventa
            +--> experiencia verificada
```

La conversacion interna debe permitir, de manera gradual:

- consultar por un producto;
- responder como vendedor;
- compartir productos dentro de la conversacion;
- agregar al carrito;
- crear o consultar un pedido;
- coordinar compra, retiro o entrega;
- atender la postventa;
- compartir una experiencia despues de una compra real.

## Arquitectura propuesta

La conversacion interna es canonica. Las conexiones externas no se
guardan directamente como columnas fijas de `conversations`, porque
una misma conversacion puede relacionarse con mas de un canal.

Entidades previstas:

- `conversations`: contenedor comercial interno ya iniciado.
- `conversation_participants`: usuarios y roles participantes.
- `conversation_messages`: contenido cronologico interno.
- `conversation_channel_links`: vinculos opcionales con hilos o
  cuentas externas.
- `inbound_content`: material recibido desde grupos, mayoristas,
  archivos o enlaces.
- `publication_drafts`: borradores revisables antes de publicar.
- `distribution_jobs`: registro de publicaciones o acciones de
  compartir hacia canales externos.
- `experiences`: opiniones vinculadas a compras verificadas y
  sujetas a moderacion.

Estas entidades se incorporaran en sprints separados. No deben
crearse todas juntas.

## Estrategia para que la conversacion permanezca en WalZ One

No se intentara bloquear el uso de WhatsApp o redes. WalZ One debe
ofrecer ventajas que solo existen dentro de la plataforma:

- producto y precio actualizados;
- identidad de tienda;
- carrito y pedido;
- historial de compra y venta;
- seguimiento de pago y entrega;
- postventa vinculada al pedido;
- experiencia de compra verificada;
- moderacion y soporte de WalZ One Central;
- continuidad aunque el contenido externo desaparezca.

Las publicaciones externas deben incluir enlaces que regresen al
producto, la tienda o una nueva conversacion en WalZ One.

## Separaciones obligatorias

- Recibir material no equivale a publicar un producto.
- Publicar un producto no equivale a iniciar una conversacion.
- Conversacion interna no equivale a copiar todo un chat externo.
- Compartir hacia redes no equivale a publicidad paga.
- Experiencia de compra no equivale a mensaje privado.
- Credenciales y tokens externos nunca se guardan en el frontend,
  el repositorio ni los mensajes.

## Orden de desarrollo

1. Conversaciones internas seguras.
2. Participantes y mensajes internos.
3. Producto, carrito, pedido y postventa dentro de la conversacion.
4. Experiencias vinculadas a compras verificadas.
5. Bandeja de material recibido y borradores de publicacion.
6. Distribucion asistida hacia redes.
7. Conectores oficiales externos, canal por canal.
8. Consolidacion omnicanal cuando exista una base interna estable.

## Criterio para integraciones externas

Cada canal debe evaluarse por separado antes de programarlo:

- cuenta y tipo de perfil requerido;
- permisos y revision de la aplicacion;
- posibilidad real de leer, publicar o responder;
- limites, ventanas y costos;
- privacidad y consentimiento;
- politicas sobre grupos, mensajes y automatizacion;
- mecanismo de revocacion y auditoria.

La imposibilidad de automatizar un canal no debe bloquear WalZ One.
Siempre debe existir un camino manual o asistido que termine en el
mismo borrador y en la misma publicacion interna.

## WalZ One Central como publicador

El motor de borradores y distribucion debe poder ser reutilizado por
dos tipos de publicador:

- una tienda o vendedor;
- WalZ One Central.

Se reutiliza la tecnologia, pero no se mezclan identidades,
permisos ni inventarios.

Una tienda publica productos, promociones y novedades propias.
WalZ One Central publica contenido institucional, incorporaciones,
campanas generales, ayuda, historias de vendedores y comunicaciones
de la plataforma.

Toda publicacion debe conservar:

- quien la creo;
- a quien representa;
- en que canales fue compartida;
- fecha, estado y resultado;
- enlace de regreso a WalZ One;
- historial de cambios y cancelaciones.

WalZ One Central no debe apropiarse automaticamente del contenido de
un vendedor ni mezclar publicidad Central con publicidad particular.
