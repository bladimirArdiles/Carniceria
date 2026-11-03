
# Carnicería - Mostrador

Sistema interno para el vendedor de una carnicería. Pensado para tablet o computadora de mostrador (botones grandes, alto contraste).
Funciona 100% en el navegador y guarda todo en `localStorage`.

## Puesta en marcha

```bash
npm install
npm run dev        # desarrollo (accesible desde la tablet en la red local)
npm run build      # genera dist/ para publicar
npm run preview    # prueba la versión compilada
```

Requiere Node 18 o superior. Desde la tablet abrí la dirección "Network" que muestra `npm run dev`.

## Estructura

```
carniceria/
├── .claude/skills/skill-diseño/   Skill de diseño (taste-skill)
├── index.html
├── vite.config.js
└── src/
    ├── main.jsx · index.css       Entrada, fuentes Geist, clases base (.field .btn-primary .card)
    ├── App.jsx                    Barra lateral (tablet/PC) o inferior (móvil), tema, avisos
    ├── lib/
    │   ├── store.jsx              Estado global y acciones (venta, stock, pagos, respaldo)
    │   ├── storage.js             Hook useStored (localStorage)
    │   ├── format.js              Moneda ARS, fechas, productos de ejemplo
    │   └── stats.js               Métricas y series para la gráfica
    ├── pages/
    │   ├── Counter.jsx            Punto de venta
    │   ├── Stock.jsx              Inventario, alertas y movimientos
    │   ├── Customers.jsx          Clientes, fiados e historial
    │   └── Reports.jsx            Dashboard, gráfica, caja y respaldo
    └── components/
        ├── ui/                    Modal, Segmented, Badge, EmptyState, ConfirmButton, LineChart
        ├── pos/                   QtyDialog (teclado numérico), Ticket
        ├── stock/                 MovementForm, ProductForm
        └── customers/             CustomerForm, PaymentForm
```

## Cómo funciona

- **Venta:** tocá un producto, tipeá los kilos (o elegí 250 g, 500 g, 1 kg) y se agrega al ticket. Elegí cliente y forma de pago y cobrá.
  El stock se descuenta solo. Anular una venta desde Reportes devuelve el stock.
- **Fiado:** requiere un cliente registrado. La deuda de cada cliente = ventas fiadas - pagos recibidos.
- **Stock:** etiquetas "Stock bajo" (igual o menor al mínimo) y "Sin stock". Movimientos: compra, merma o conteo (ajuste al valor contado).
- **Productos de ejemplo:** los precios y stocks iniciales son de muestra. Editalos desde Stock.

## Importante

Los datos viven solo en el navegador de ese equipo. Descargá un respaldo desde Reportes con frecuencia.
