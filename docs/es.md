# Flair

Controle sus rejillas inteligentes [Flair](https://flair.co) (Smart Vents)
desde Gladys, siga la temperatura de cada habitación y cambie su casa entre
En casa y Fuera.

## Qué obtiene

Tras la configuración, la pestaña **Descubrimiento** muestra un dispositivo
por cada elemento Flair:

| Elemento Flair | En Gladys                                                                   |
| -------------- | --------------------------------------------------------------------------- |
| Casa           | Interruptor **En casa** (apagado = Fuera), **Modo auto** (apagado = Manual) |
| Habitación     | **Consigna** (termostato), **Temperatura**, **Humedad**, **Activa**         |
| Smart Vent     | **Apertura** (0 % cerrada a 100 % abierta) y los botones abrir / cerrar     |
| Puck           | **Temperatura**, **Humedad**                                                |

Cada dispositivo muestra una insignia **cloud**: Flair solo se controla a
través de su nube. La insignia pasa a **inaccesible** cuando Flair no
responde, o cuando una rejilla o un puck deja de informar (batería agotada,
fuera de alcance).

## Antes de empezar: obtener sus credenciales de API

Flair abre su API a petición: escriba al soporte de Flair (desde el sitio web
o la app de Flair) y pida **credenciales de API** para su cuenta. Recibirá un
**ID de cliente** (client ID) y un **secreto de cliente** (client secret).

## Configuración

1. Abra la pestaña **Configuración** de la integración.
2. Pegue el **ID de cliente** y el **Secreto de cliente**.
3. Si lo desea, cambie el **Intervalo de actualización**: la integración lee
   su cuenta Flair cada 2 minutos por defecto (un minuto como mínimo).
4. Guarde y pulse **Probar la conexión**: la respuesta indica las casas,
   habitaciones, rejillas y pucks encontrados.
5. Abra la pestaña **Descubrimiento** y añada los dispositivos que quiera.

## Conviene saber

- En modo **Auto**, Flair abre y cierra las rejillas por sí mismo para
  alcanzar la consigna de cada habitación. Una apertura ajustada desde Gladys
  se mantiene hasta la siguiente decisión de Flair. Para que las rejillas se
  queden donde las pone, pase la casa a **Manual** (interruptor **Modo
  auto**).
- Flair deja de lado una habitación **inactiva**: sus rejillas permanecen
  cerradas.
- Un cambio hecho en la app de Flair llega a Gladys en la siguiente
  actualización.

## Escenas

La integración añade sus propias tarjetas al editor de escenas, en la
categoría **Integraciones**.

Disparadores:

- **Flair en casa o fuera cambió** — una casa pasó de En casa a Fuera o al
  revés (app Flair, geovalla o Gladys… salvo un cambio hecho por la misma
  escena). Elija opcionalmente la casa y el nuevo modo. Las acciones
  siguientes pueden leer `{{triggerEvent.data.mode}}` (`home` o `away`) y
  `{{triggerEvent.data.home_name}}`.
- **Dispositivo Flair en línea o sin conexión** — una rejilla o un puck dejó
  de responder, o ha vuelto. Elija opcionalmente el dispositivo y el estado.
  Variables: `{{triggerEvent.data.status}}` (`offline` u `online`) y
  `{{triggerEvent.data.device_name}}`.

Acciones:

- **Ajustar la apertura de una rejilla Flair** — de 0 a 100 %. Devuelve la
  apertura y si la casa está en modo Auto (Flair puede entonces volver a
  mover la rejilla).
- **Ajustar la consigna de una habitación Flair** — de 10 a 32 °C. Devuelve
  la consigna.
- **Poner una casa Flair En casa o Fuera** — devuelve si la casa está En
  casa.
- **Poner una casa Flair en Auto o Manual** — devuelve si el modo Auto está
  activo.

## Panel

Añada el widget **Resumen de Flair** a un panel. Muestra la temperatura media
de las habitaciones, el número de rejillas abiertas, los dispositivos sin
conexión, y luego cada casa (En casa / Fuera, Auto / Manual) y cada
habitación (temperatura → consigna, en verde si está cerca, naranja o rojo si
está lejos). Sus botones cambian la primera casa entre En casa y Fuera, entre
Auto y Manual, y actualizan los datos al instante.

## Solución de problemas

- **«Flair rechazó las credenciales de la API»** — compruebe el ID y el
  secreto de cliente, sin espacios alrededor. Contacte con el soporte de
  Flair si el rechazo continúa.
- **«La nube de Flair no responde»** — Flair o su conexión a Internet no
  funcionan. La integración lo reintenta en cada actualización.
- **Un dispositivo sigue inaccesible** — revise su batería y su distancia al
  puente (bridge) Flair en la app de Flair.
- Más detalles en los registros de la integración (interfaz de Gladys, o
  `docker logs` en el host), con `LOG_LEVEL=debug`.
