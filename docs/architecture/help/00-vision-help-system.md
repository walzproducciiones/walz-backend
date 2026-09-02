# Vision del sistema de ayuda de WalZ One

Fecha: 1 de septiembre de 2026

## Principio de simplicidad

Si WalZ One es facil para el comprador y para el vendedor, debe ser
facil de administrar. La Administracion Central necesita mas
permisos y herramientas, pero no una experiencia innecesariamente
tecnica o complicada.

La regla de producto es:

```text
Comprador: encontrar -> consultar -> comprar
Vendedor: recibir -> revisar -> publicar -> vender
Central: detectar -> comprender -> resolver -> registrar
```

Cada recorrido debe utilizar el mismo lenguaje que la plataforma y
mostrar solamente las decisiones necesarias para ese usuario.

## Un solo conocimiento, tres experiencias

No se construiran tres manuales desconectados. Existira una base de
conocimiento comun, presentada segun el rol y el contexto.

### Compradores

Ayuda para:

- registrarse e iniciar sesion;
- buscar tiendas y productos;
- conversar con un vendedor;
- usar carrito y checkout;
- elegir pago, retiro o entrega;
- consultar un pedido;
- resolver una dificultad de compra;
- compartir una experiencia verificada.

### Vendedores

Ayuda contextual para:

- configurar la tienda;
- cargar o importar productos;
- trabajar con fotos y descripciones;
- definir precio, stock y promociones;
- revisar material recibido desde mayoristas o WhatsApp;
- publicar y compartir hacia redes;
- responder conversaciones;
- gestionar pedidos, pagos, retiros y entregas;
- comprender avisos, rechazos y estados.

### WalZ One Central

Ayuda operativa paralela para:

- localizar una tienda, usuario, producto, pedido o conversacion;
- comprender que ocurrio y en que etapa;
- resolver solicitudes frecuentes con pasos guiados;
- moderar contenido y experiencias;
- atender problemas de acceso, publicacion, pago o entrega;
- revisar integraciones externas;
- comunicar incidentes o novedades;
- escalar un caso sin perder su historial;
- registrar quien realizo cada accion administrativa.

## Tres capas de ayuda

### 1. Ayuda contextual

Explicaciones breves junto al formulario, boton o estado que puede
generar dudas. Debe resolver la mayoria de las preguntas sin sacar
al usuario de su tarea.

### 2. Centro de ayuda

Contenido buscable por tema, rol y problema. Debe incluir guias
cortas, preguntas frecuentes y recorridos paso a paso.

### 3. Resolucion guiada

Para problemas concretos, WalZ One hace preguntas simples y propone
acciones seguras. En Central puede abrir o continuar un caso de
soporte con historial y auditoria.

## Arquitectura prevista

Entidades futuras, a implementar por etapas:

- `help_articles`: contenido comun con audiencia y contexto.
- `help_categories`: organizacion por area funcional.
- `help_flows`: diagnosticos o recorridos guiados.
- `help_feedback`: indica si una ayuda resolvio el problema.
- `support_cases`: problema concreto que necesita seguimiento.
- `support_case_events`: mensajes, cambios de estado y acciones.

El contenido de ayuda debe poder editarse en el futuro sin modificar
el codigo de la aplicacion.

## Reglas para Administracion Central

- No exponer tablas, UUID, excepciones tecnicas o datos internos si
  no son necesarios para decidir.
- Mostrar primero el problema, su contexto y la accion segura.
- Pedir confirmacion para acciones sensibles.
- Mantener auditoria de cambios administrativos.
- Separar lectura, correccion y eliminacion.
- No permitir que una accion masiva sea el camino por defecto.
- Reutilizar las mismas palabras y estados que ven comprador y
  vendedor.

## Relacion con conversaciones

La ayuda y las conversaciones se complementan, pero no son lo mismo.

- Una conversacion comercial vincula comprador, vendedor, producto
  y pedido.
- Una consulta de ayuda explica como usar la plataforma.
- Un caso de soporte registra un problema que Central debe resolver.

Una conversacion puede generar un caso de soporte, y el caso puede
conservar un enlace a la conversacion, pedido o publicacion sin
copiar innecesariamente todo su contenido.

## Orden de implementacion

1. Ayuda contextual en las tareas mas frecuentes del vendedor.
2. Ayuda basica para compra, pedido y entrega del comprador.
3. Centro de ayuda comun con busqueda por rol y tema.
4. Resolucion guiada de problemas repetidos.
5. Casos de soporte para WalZ One Central.
6. Edicion administrativa del contenido de ayuda.
7. Sugerencias conversacionales sobre la base aprobada.

La inteligencia artificial, si se incorpora, debe buscar y sugerir
contenido aprobado. No debe ejecutar cambios sensibles ni inventar
politicas de la plataforma.
