
/* app.js · Instrumentos Sintek · Supabase */

// ============================================================
// 1. CONFIGURACIÓN Y CONEXIÓN CON SUPABASE
// ============================================================

const SUPABASE_URL = "https://phgozpmwgtbdiwzbbvcm.supabase.co";
const SUPABASE_KEY = "sb_publishable_xGK8x1qxR8s_LjP3tcy6zA_62wPGS4o";

let db = null;

function inicializarSupabase() {
  return new Promise((resolve, reject) => {
    if (window.supabase) {
      db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      resolve(db);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

    script.onload = () => {
      db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      resolve(db);
    };

    script.onerror = () => {
      reject(new Error("No se pudo cargar la librería de Supabase"));
    };

    document.head.appendChild(script);
  });
}

// ============================================================
// 2. FUNCIONES GENERALES
// ============================================================

function mostrarAviso(texto) {
  const aviso = document.createElement("div");

  aviso.className = "aviso-flotante";
  aviso.setAttribute("role", "status");
  aviso.textContent = texto;

  document.body.appendChild(aviso);

  setTimeout(() => aviso.remove(), 2500);
}

function aNumero(valor) {
  if (typeof valor === "number") {
    return Number.isNaN(valor) ? 0 : valor;
  }

  const limpio = parseFloat(
    String(valor || 0).replace(/[^0-9.-]+/g, "")
  );

  return Number.isNaN(limpio) ? 0 : limpio;
}

function dinero(numero) {
  return "$" + aNumero(numero).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escaparHTML(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[caracter]);
}

async function obtenerSiguienteId(tabla) {
  const { data, error } = await db
    .from(tabla)
    .select("identificacion")
    .order("identificacion", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return 1;
  }

  return Number(data[0].identificacion) + 1;
}

// ============================================================
// 3. COMPROBAR CONEXIÓN
// ============================================================

async function probarConexion() {
  try {
    await inicializarSupabase();

    const { error } = await db
      .from("productos")
      .select("identificacion")
      .limit(1);

    if (error) {
      console.error("Error de conexión con Supabase:", error.message);
      return false;
    }

    console.log("Conexión exitosa con Supabase");
    return true;

  } catch (error) {
    console.error("Error inicializando Supabase:", error);
    return false;
  }
}

// ============================================================
// 4. CARGA AUTOMÁTICA DE TABLAS
// ============================================================

async function cargarTablasAutomaticamente() {
  if (!db) return;

  const pagina = location.pathname.toLowerCase();

  const tablas = Array.from(
    document.querySelectorAll("table:not(#tabla-carrito-venta)")
  ).filter(tabla => {
    // El historial y los detalles de edición tienen su propio cargador.
    return !tabla.closest("#editor-venta") &&
      !tabla.querySelector("#tabla-ventas-historial");
  });

  if (tablas.length === 0) return;

  for (const tabla of tablas) {
    const thead = tabla.querySelector("thead");

    let tbody = tabla.querySelector("tbody");

    if (!tbody) {
      tbody = document.createElement("tbody");
      tabla.appendChild(tbody);
    }

    const encabezados = thead
      ? Array.from(thead.querySelectorAll("th")).map(th =>
          th.textContent.trim().toLowerCase()
        )
      : [];

    const esTablaVentas =
      pagina.includes("reporte") ||
      pagina.includes("venta") ||
      encabezados.some(h =>
        h.includes("venta") ||
        h.includes("cliente") ||
        h.includes("fecha")
      );

    // --------------------------------------------------------
    // TABLAS DE VENTAS GENERALES
    // --------------------------------------------------------

    if (esTablaVentas) {
      const { data: ventas, error } = await db
        .from("ventas")
        .select(`
          identificacion,
          numventa,
          fecha,
          clientes ( nombre, correo ),
          detalle_ventas (
            cantidad,
            precio,
            total_parcial,
            detalle,
            productos ( nombre, numserie )
          )
        `)
        .order("identificacion", { ascending: false });

      if (error) {
        console.error("Error cargando ventas:", error.message);
        continue;
      }

      if (!ventas || ventas.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="${encabezados.length || 5}" style="text-align:center;">
              No hay ventas registradas en Supabase.
            </td>
          </tr>
        `;
        continue;
      }

      tbody.innerHTML = ventas.map(venta => {
        const cliente = venta.clientes
          ? venta.clientes.nombre
          : "Público general";

        const detalles = venta.detalle_ventas || [];

        const subtotal = detalles.reduce((acumulado, detalle) => {
          const importe = aNumero(detalle.total_parcial) ||
            (
              aNumero(detalle.cantidad) *
              aNumero(detalle.precio)
            );

          return acumulado + importe;
        }, 0);

        const iva = subtotal * 0.16;
        const total = subtotal + iva;

        const resumen = detalles.map(detalle => {
          const nombre =
            detalle.productos?.nombre ||
            detalle.detalle ||
            "Producto";

          return `${nombre} (x${detalle.cantidad})`;
        }).join(", ") || "Sin detalle";

        if (encabezados.length > 0) {
          return `
            <tr>
              ${encabezados.map(encabezado => {
                if (
                  encabezado.includes("num") ||
                  encabezado.includes("folio") ||
                  encabezado.includes("id")
                ) {
                  return `<td>#${escaparHTML(
                    venta.numventa || venta.identificacion
                  )}</td>`;
                }

                if (encabezado.includes("fecha")) {
                  return `<td>${escaparHTML(venta.fecha || "-")}</td>`;
                }

                if (encabezado.includes("cliente")) {
                  return `<td>${escaparHTML(cliente)}</td>`;
                }

                if (
                  encabezado.includes("producto") ||
                  encabezado.includes("detalle") ||
                  encabezado.includes("concepto")
                ) {
                  return `<td>${escaparHTML(resumen)}</td>`;
                }

                if (encabezado.includes("subtotal")) {
                  return `<td>${dinero(subtotal)}</td>`;
                }

                if (encabezado.includes("iva")) {
                  return `<td>${dinero(iva)}</td>`;
                }

                if (
                  encabezado.includes("total") ||
                  encabezado.includes("importe") ||
                  encabezado.includes("monto") ||
                  encabezado.includes("precio")
                ) {
                  return `<td><strong>${dinero(total)}</strong></td>`;
                }

                return "<td>-</td>";
              }).join("")}
            </tr>
          `;
        }

        return `
          <tr>
            <td>#${escaparHTML(venta.numventa || venta.identificacion)}</td>
            <td>${escaparHTML(venta.fecha || "-")}</td>
            <td>${escaparHTML(cliente)}</td>
            <td>${escaparHTML(resumen)}</td>
            <td><strong>${dinero(total)}</strong></td>
          </tr>
        `;
      }).join("");

      continue;
    }

    // --------------------------------------------------------
    // TABLAS DE PRODUCTOS E INVENTARIO
    // --------------------------------------------------------

    const { data: productos, error } = await db
      .from("productos")
      .select("*")
      .order("identificacion", { ascending: true });

    if (error) {
      console.error("Error cargando productos:", error.message);
      continue;
    }

    if (!productos || productos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${encabezados.length || 5}" style="text-align:center;">
            No hay productos registrados en Supabase.
          </td>
        </tr>
      `;
      continue;
    }

    tbody.innerHTML = productos.map(producto => {
      const stock = Number(producto.continuo ?? 0);
      const precio = aNumero(producto.precio);

      const estado = stock === 0
        ? ["no", "No disponible"]
        : stock <= 3
          ? ["poco", "Por agotarse"]
          : ["ok", "Disponible"];

      const badgeEstado = `
        <span class="estado estado--${estado[0]}">
          ${estado[1]}
        </span>
      `;

      if (encabezados.length > 0) {
        return `
          <tr>
            ${encabezados.map(encabezado => {
              if (
                encabezado.includes("código") ||
                encabezado.includes("codigo") ||
                encabezado.includes("serie")
              ) {
                return `<td>${escaparHTML(
                  producto.numserie || producto.identificacion
                )}</td>`;
              }

              if (encabezado.includes("id")) {
                return `<td>${producto.identificacion}</td>`;
              }

              if (
                encabezado.includes("nombre") ||
                encabezado.includes("producto") ||
                encabezado.includes("instrumento")
              ) {
                return `<td>${escaparHTML(producto.nombre || "-")}</td>`;
              }

              if (encabezado.includes("marca")) {
                return `<td>${escaparHTML(producto.marca || "-")}</td>`;
              }

              if (encabezado.includes("modelo")) {
                return `<td>${escaparHTML(producto.modelo || "-")}</td>`;
              }

              if (
                encabezado.includes("tipo") ||
                encabezado.includes("categor")
              ) {
                return `<td>${escaparHTML(
                  producto.tipo_producto || "-"
                )}</td>`;
              }

              if (encabezado.includes("total")) {
                return `<td>${dinero(
                  producto.total_parcial ?? precio * stock
                )}</td>`;
              }

              if (
                encabezado.includes("precio") ||
                encabezado.includes("costo")
              ) {
                return `<td>${dinero(precio)}</td>`;
              }

              if (
                encabezado.includes("stock") ||
                encabezado.includes("existencia") ||
                encabezado.includes("cant") ||
                encabezado.includes("disponible")
              ) {
                return `<td>${stock}</td>`;
              }

              if (
                encabezado.includes("estado") ||
                encabezado.includes("estatus")
              ) {
                return `<td>${badgeEstado}</td>`;
              }

              if (
                encabezado.includes("acción") ||
                encabezado.includes("accion") ||
                encabezado.includes("opci")
              ) {
                return `
                  <td>
                    <button
                      type="button"
                      class="boton boton--contorno"
                      onclick="eliminarProducto(${producto.identificacion})"
                    >
                      Eliminar
                    </button>
                  </td>
                `;
              }

              return "<td>-</td>";
            }).join("")}
          </tr>
        `;
      }

      return `
        <tr>
          <td>${escaparHTML(producto.numserie || producto.identificacion)}</td>
          <td>${escaparHTML(producto.nombre || "-")}</td>
          <td>${dinero(precio)}</td>
          <td>${stock}</td>
          <td>${badgeEstado}</td>
        </tr>
      `;
    }).join("");
  }
}

// ============================================================
// 5. ELIMINAR PRODUCTOS
// ============================================================

window.eliminarProducto = async function(identificacion) {
  if (!db) {
    mostrarAviso("No hay conexión con la base de datos.");
    return;
  }

  if (!confirm("¿Seguro que deseas eliminar este producto de Supabase?")) {
    return;
  }

  const { error } = await db
    .from("productos")
    .delete()
    .eq("identificacion", identificacion);

  if (error) {
    mostrarAviso("No se pudo eliminar: " + error.message);
    return;
  }

  mostrarAviso("Producto eliminado");

  await cargarTablasAutomaticamente();
};

// ============================================================
// 6. REGISTRAR VENTAS
// ============================================================

async function inicializarModuloVentas() {
  const vistaVenta = document.getElementById("vista-registrar-venta");

  if (!vistaVenta || !db) return;

  const inputFolio = document.getElementById("folio");
  const inputFecha = document.getElementById("fecha");
  const selectCliente = document.getElementById("select-cliente");
  const selectProducto = document.getElementById("select-producto-venta");
  const inputCantidad = document.getElementById("cant-producto-venta");
  const btnAgregar = document.getElementById("btn-agregar-producto");
  const tbodyCarrito = document.getElementById("tbody-carrito-venta");
  const elSubtotal = document.getElementById("venta-subtotal");
  const elIva = document.getElementById("venta-iva");
  const elTotal = document.getElementById("venta-total");
  const btnGuardarVenta = document.getElementById("btn-guardar-venta");

  if (
    !inputFolio ||
    !inputFecha ||
    !selectCliente ||
    !selectProducto ||
    !inputCantidad ||
    !btnAgregar ||
    !tbodyCarrito ||
    !elSubtotal ||
    !elIva ||
    !elTotal ||
    !btnGuardarVenta
  ) {
    console.error("Faltan elementos del formulario de ventas.");
    return;
  }

  let catalogoProductos = [];
  let carrito = [];

  inputFecha.value = new Date().toISOString().split("T")[0];

  try {
    const siguienteVentaId = await obtenerSiguienteId("ventas");
    inputFolio.value = 1000 + siguienteVentaId;

    const { data: clientes, error: errorClientes } = await db
      .from("clientes")
      .select("*")
      .order("identificacion", { ascending: true });

    if (errorClientes) throw errorClientes;

    if (clientes && clientes.length > 0) {
      selectCliente.innerHTML = clientes.map(cliente => `
        <option value="${cliente.identificacion}">
          ${escaparHTML(cliente.nombre)}
        </option>
      `).join("");
    } else {
      selectCliente.innerHTML = `
        <option value="GENERAL">
          Público general (se creará automáticamente)
        </option>
      `;
    }

    const { data: productos, error: errorProductos } = await db
      .from("productos")
      .select("*")
      .order("nombre", { ascending: true });

    if (errorProductos) throw errorProductos;

    catalogoProductos = productos || [];

    if (catalogoProductos.length > 0) {
      selectProducto.innerHTML = catalogoProductos.map(producto => {
        const stock = Number(producto.continuo ?? 0);
        const deshabilitado = stock <= 0 ? "disabled" : "";

        return `
          <option value="${producto.identificacion}" ${deshabilitado}>
            ${escaparHTML(producto.nombre)} - ${dinero(producto.precio)}
            (Disp: ${stock})
          </option>
        `;
      }).join("");
    } else {
      selectProducto.innerHTML = `
        <option value="">No hay productos registrados</option>
      `;
    }

  } catch (error) {
    console.error("Error preparando formulario de venta:", error);
    mostrarAviso("No se pudieron cargar los datos de la venta.");
    return;
  }

  function renderizarCarrito() {
    if (carrito.length === 0) {
      tbodyCarrito.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;">
            Agrega productos para iniciar la venta
          </td>
        </tr>
      `;

      elSubtotal.textContent = "$0.00";
      elIva.textContent = "$0.00";
      elTotal.textContent = "$0.00";
      return;
    }

    let subtotal = 0;

    tbodyCarrito.innerHTML = carrito.map((item, indice) => {
      const importe = aNumero(item.precio) * aNumero(item.cantidad);

      subtotal += importe;

      return `
        <tr>
          <td>${escaparHTML(item.nombre)}</td>
          <td>${dinero(item.precio)}</td>
          <td>${item.cantidad}</td>
          <td>${dinero(importe)}</td>
          <td>
            <button
              type="button"
              class="boton boton--contorno"
              onclick="quitarItemVenta(${indice})"
            >
              X
            </button>
          </td>
        </tr>
      `;
    }).join("");

    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    elSubtotal.textContent = dinero(subtotal);
    elIva.textContent = dinero(iva);
    elTotal.textContent = dinero(total);
  }

  window.quitarItemVenta = function(indice) {
    carrito.splice(indice, 1);
    renderizarCarrito();
  };

  btnAgregar.addEventListener("click", () => {
    const idProducto = parseInt(selectProducto.value, 10);
    const cantidad = parseInt(inputCantidad.value, 10);

    if (!idProducto || !Number.isInteger(cantidad) || cantidad <= 0) {
      mostrarAviso("Selecciona un producto y una cantidad válida.");
      return;
    }

    const producto = catalogoProductos.find(
      p => Number(p.identificacion) === idProducto
    );

    if (!producto) {
      mostrarAviso("No se encontró el producto seleccionado.");
      return;
    }

    const existente = carrito.find(
      item => item.id_producto === idProducto
    );

    const cantidadSolicitada =
      (existente ? existente.cantidad : 0) + cantidad;

    if (cantidadSolicitada > Number(producto.continuo ?? 0)) {
      mostrarAviso(
        `Stock insuficiente. Solo hay ${producto.continuo} disponibles.`
      );
      return;
    }

    if (existente) {
      existente.cantidad += cantidad;
    } else {
      carrito.push({
        id_producto: idProducto,
        nombre: producto.nombre,
        precio: aNumero(producto.precio),
        cantidad,
        stock_actual: Number(producto.continuo || 0)
      });
    }

    inputCantidad.value = 1;
    renderizarCarrito();
  });

  btnGuardarVenta.addEventListener("click", async () => {
    if (carrito.length === 0) {
      mostrarAviso("Agrega al menos un producto antes de continuar.");
      return;
    }

    btnGuardarVenta.disabled = true;
    btnGuardarVenta.textContent = "Registrando venta...";

    try {
      let idClienteFinal = parseInt(selectCliente.value, 10);

      if (Number.isNaN(idClienteFinal)) {
        const nuevoClienteId = await obtenerSiguienteId("clientes");

        const { error: errorCliente } = await db
          .from("clientes")
          .insert([{
            identificacion: nuevoClienteId,
            nombre: "Público general",
            telefono: "0000000000",
            fecha: inputFecha.value,
            correo: "general@sintek.local"
          }]);

        if (errorCliente) throw errorCliente;

        idClienteFinal = nuevoClienteId;
      }

      const idVenta = await obtenerSiguienteId("ventas");
      const numeroVenta = parseInt(inputFolio.value, 10) || idVenta;

      const { error: errorVenta } = await db
        .from("ventas")
        .insert([{
          identificacion: idVenta,
          id_cliente: idClienteFinal,
          numventa: numeroVenta,
          fecha: inputFecha.value
        }]);

      if (errorVenta) throw errorVenta;

      let siguienteDetalleId =
        await obtenerSiguienteId("detalle_ventas");

      for (const item of carrito) {
        const totalParcial =
          aNumero(item.precio) * aNumero(item.cantidad);

        const { error: errorDetalle } = await db
          .from("detalle_ventas")
          .insert([{
            identificacion: siguienteDetalleId++,
            detalle: item.nombre,
            id_venta: idVenta,
            id_producto: item.id_producto,
            cantidad: item.cantidad,
            precio: aNumero(item.precio),
            total_parcial: totalParcial
          }]);

        if (errorDetalle) throw errorDetalle;

        const nuevoStock = Math.max(
          0,
          item.stock_actual - item.cantidad
        );

        const { error: errorStock } = await db
          .from("productos")
          .update({
            continuo: nuevoStock,
            total_parcial: nuevoStock * aNumero(item.precio)
          })
          .eq("identificacion", item.id_producto);

        if (errorStock) throw errorStock;
      }

      sessionStorage.setItem("ultima_venta", JSON.stringify({
        id_venta: idVenta,
        numventa: numeroVenta,
        total: elTotal.textContent
      }));

      mostrarAviso(
        "Venta #" + numeroVenta + " registrada correctamente."
      );

      setTimeout(() => {
        location.href = "ventas.html";
      }, 900);

    } catch (error) {
      console.error("Error al registrar la venta:", error);

      mostrarAviso(
        "Error al guardar venta: " + (error.message || error)
      );

      btnGuardarVenta.disabled = false;
      btnGuardarVenta.textContent = "Continuar al pago";
    }
  });
}

// ============================================================
// 7. EDICIÓN DE VENTAS
// ============================================================

async function inicializarModuloEdicionVentas() {
  const tabla = document.querySelector("#tabla-ventas-historial");

  const editor = document.getElementById("editor-venta");

  if (!tabla || !editor || !db) return;

  const elCliente = document.getElementById("editar-cliente");
  const elMetodo = document.getElementById("editar-metodo-pago");
  const elProducto = document.getElementById("editar-producto");
  const elCantidad = document.getElementById("editar-cantidad");
  const elDetalles = document.getElementById("editar-detalles");
  const elSubtotal = document.getElementById("editar-subtotal");
  const elIva = document.getElementById("editar-iva");
  const elTotal = document.getElementById("editar-total");
  const elFolio = document.getElementById("edicion-folio");
  const elMensaje = document.getElementById("editar-mensaje");
  const btnGuardar = document.getElementById("btn-guardar-edicion");
  const btnAgregar = document.getElementById("btn-agregar-edicion");
  const btnCerrar = document.getElementById("btn-cerrar-editor");
  const btnCancelar = document.getElementById("btn-cancelar-edicion");

  if (
    !elCliente ||
    !elMetodo ||
    !elProducto ||
    !elCantidad ||
    !elDetalles ||
    !elSubtotal ||
    !elIva ||
    !elTotal ||
    !elFolio ||
    !elMensaje ||
    !btnGuardar ||
    !btnAgregar ||
    !btnCerrar ||
    !btnCancelar
  ) {
    console.error("Faltan elementos HTML necesarios para editar ventas.");
    return;
  }

  let ventas = [];
  let clientes = [];
  let productos = [];
  let ventaActual = null;
  let carritoEdicion = [];
  let cantidadesOriginales = {};

  // ----------------------------------------------------------
  // STOCK DISPONIBLE PARA LA EDICIÓN
  // ----------------------------------------------------------

  function stockDisponible(productoId) {
    const producto = productos.find(
      p => Number(p.identificacion) === Number(productoId)
    );

    if (!producto) return 0;

    return Number(producto.continuo || 0) +
      Number(cantidadesOriginales[productoId] || 0);
  }

  // ----------------------------------------------------------
  // CÁLCULO DE SUBTOTAL, IVA Y TOTAL
  // ----------------------------------------------------------

  function calcularTotales() {
    const subtotal = carritoEdicion.reduce(
      (suma, item) =>
        suma + Number(item.precio) * Number(item.cantidad),
      0
    );

    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    elSubtotal.textContent = dinero(subtotal);
    elIva.textContent = dinero(iva);
    elTotal.textContent = dinero(total);

    return { subtotal, iva, total };
  }

  // ----------------------------------------------------------
  // MOSTRAR PRODUCTOS DE LA VENTA
  // ----------------------------------------------------------

  function renderizarDetalles() {
    if (carritoEdicion.length === 0) {
      elDetalles.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;">
            Agrega al menos un producto.
          </td>
        </tr>
      `;

      calcularTotales();
      return;
    }

    elDetalles.innerHTML = carritoEdicion.map((item, indice) => {
      const parcial = Number(item.precio) * Number(item.cantidad);

      return `
        <tr>
          <td>${escaparHTML(item.nombre)}</td>
          <td>${dinero(item.precio)}</td>

          <td>
            <input
              type="number"
              min="1"
              step="1"
              value="${Number(item.cantidad)}"
              data-cantidad-indice="${indice}"
              aria-label="Cantidad de ${escaparHTML(item.nombre)}"
              style="width:85px;"
            >
          </td>

          <td>${dinero(parcial)}</td>

          <td>
            <button
              type="button"
              class="boton boton--contorno"
              data-quitar-indice="${indice}"
            >
              Quitar
            </button>
          </td>
        </tr>
      `;
    }).join("");

    calcularTotales();
  }

  // ----------------------------------------------------------
  // CARGAR SELECTOR DE PRODUCTOS
  // ----------------------------------------------------------

  function llenarSelectProductos() {
    elProducto.innerHTML = productos.map(producto => {
      const disponible = stockDisponible(producto.identificacion);

      return `
        <option value="${producto.identificacion}">
          ${escaparHTML(producto.nombre)}
          · ${dinero(producto.precio)}
          · Disponibles: ${disponible}
        </option>
      `;
    }).join("");

    if (productos.length === 0) {
      elProducto.innerHTML = `
        <option value="">No hay productos registrados</option>
      `;
    }
  }

  // ----------------------------------------------------------
  // CARGAR HISTORIAL DESDE SUPABASE
  // ----------------------------------------------------------

  async function cargarHistorial() {
    tabla.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;">
          Cargando historial...
        </td>
      </tr>
    `;

    const { data, error } = await db
      .from("ventas")
      .select(`
        identificacion,
        numventa,
        fecha,
        id_cliente,
        metodo_pago,
        clientes ( identificacion, nombre ),
        detalle_ventas (
          identificacion,
          id_producto,
          cantidad,
          precio,
          total_parcial,
          detalle,
          productos ( nombre )
        )
      `)
      .order("identificacion", { ascending: false });

    if (error) {
      console.error("Error cargando historial:", error);

      tabla.innerHTML = `
        <tr>
          <td colspan="6">
            No se pudo cargar el historial:
            ${escaparHTML(error.message)}
          </td>
        </tr>
      `;

      return;
    }

    ventas = data || [];

    if (ventas.length === 0) {
      tabla.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;">
            No hay ventas registradas.
          </td>
        </tr>
      `;

      return;
    }

    tabla.innerHTML = ventas.map(venta => {
      const detalles = venta.detalle_ventas || [];

      const subtotal = detalles.reduce(
        (suma, detalle) =>
          suma + Number(
            detalle.total_parcial ??
            (detalle.precio * detalle.cantidad)
          ),
        0
      );

      const total = subtotal * 1.16;

      const nombreCliente =
        venta.clientes?.nombre || "Público general";

      const resumen = detalles.map(detalle => {
        return `${
          detalle.productos?.nombre ||
          detalle.detalle ||
          "Producto"
        } (x${detalle.cantidad})`;
      }).join(", ") || "Sin detalle";

      return `
        <tr>
          <td>
            #${escaparHTML(
              venta.numventa || venta.identificacion
            )}
          </td>

          <td>${escaparHTML(venta.fecha || "-")}</td>

          <td>${escaparHTML(nombreCliente)}</td>

          <td>${escaparHTML(resumen)}</td>

          <td><strong>${dinero(total)}</strong></td>

          <td>
            <button
              type="button"
              class="boton boton--contorno"
              data-editar-venta="${Number(venta.identificacion)}"
            >
              Editar
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  // ----------------------------------------------------------
  // ABRIR EDITOR DE UNA VENTA
  // ----------------------------------------------------------

  async function abrirEditor(idVenta) {
    const ventaSeleccionada = ventas.find(
      venta => Number(venta.identificacion) === Number(idVenta)
    );

    if (!ventaSeleccionada) {
      mostrarAviso("No se encontró la venta seleccionada.");
      return;
    }

    const [
      { data: listaClientes, error: errorClientes },
      { data: listaProductos, error: errorProductos }
    ] = await Promise.all([
      db
        .from("clientes")
        .select("identificacion,nombre")
        .order("nombre"),

      db
        .from("productos")
        .select("identificacion,nombre,precio,continuo")
        .order("nombre")
    ]);

    if (errorClientes || errorProductos) {
      console.error(errorClientes || errorProductos);
      mostrarAviso("No se pudieron cargar clientes o productos.");
      return;
    }

    ventaActual = ventaSeleccionada;

    clientes = listaClientes || [];
    productos = listaProductos || [];

    if (clientes.length === 0) {
      mostrarAviso("No hay clientes registrados.");
      return;
    }

    elCliente.innerHTML = clientes.map(cliente => `
      <option value="${cliente.identificacion}">
        ${escaparHTML(cliente.nombre)}
      </option>
    `).join("");

    elCliente.value = String(ventaActual.id_cliente || "");

    if (
      elCliente.value !== String(ventaActual.id_cliente || "")
    ) {
      mostrarAviso("No se encontró el cliente asociado a esta venta.");
      return;
    }

    elMetodo.value = ventaActual.metodo_pago || "";

    cantidadesOriginales = {};
    carritoEdicion = [];

    (ventaActual.detalle_ventas || []).forEach(detalle => {
      const idProducto = Number(detalle.id_producto);
      const cantidad = Number(detalle.cantidad);

      cantidadesOriginales[idProducto] =
        (cantidadesOriginales[idProducto] || 0) + cantidad;

      const producto = productos.find(
        p => Number(p.identificacion) === idProducto
      );

      carritoEdicion.push({
        id_producto: idProducto,
        nombre: producto?.nombre || detalle.detalle || "Producto",
        precio: Number(detalle.precio),
        cantidad
      });
    });

    elFolio.textContent = "#" + (
      ventaActual.numventa || ventaActual.identificacion
    );

    elMensaje.textContent = ventaActual.metodo_pago
      ? "Puedes modificar los datos de esta venta."
      : "Esta venta no tenía método de pago guardado. Selecciona uno para actualizarla.";

    llenarSelectProductos();
    renderizarDetalles();

    editor.hidden = false;

    editor.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  // ----------------------------------------------------------
  // CERRAR EDITOR
  // ----------------------------------------------------------

  function cerrarEditor() {
    editor.hidden = true;

    ventaActual = null;
    carritoEdicion = [];
    cantidadesOriginales = {};

    elMensaje.textContent = "";
    elFolio.textContent = "";
  }

  // ----------------------------------------------------------
  // CLIC EN EDITAR DESDE EL HISTORIAL
  // ----------------------------------------------------------

  tabla.addEventListener("click", async event => {
    const boton = event.target.closest("[data-editar-venta]");

    if (!boton) return;

    boton.disabled = true;

    try {
      await abrirEditor(Number(boton.dataset.editarVenta));
    } catch (error) {
      console.error("Error abriendo editor:", error);
      mostrarAviso("No se pudo abrir el editor de la venta.");
    } finally {
      boton.disabled = false;
    }
  });

  // ----------------------------------------------------------
  // AGREGAR PRODUCTO A LA VENTA EDITADA
  // ----------------------------------------------------------

  btnAgregar.addEventListener("click", () => {
    const idProducto = Number(elProducto.value);
    const cantidad = Number(elCantidad.value);

    if (
      !Number.isInteger(cantidad) ||
      cantidad <= 0 ||
      !idProducto
    ) {
      mostrarAviso("Selecciona un producto y una cantidad válida.");
      return;
    }

    const producto = productos.find(
      p => Number(p.identificacion) === idProducto
    );

    if (!producto) {
      mostrarAviso("El producto seleccionado no existe.");
      return;
    }

    const existente = carritoEdicion.find(
      item => item.id_producto === idProducto
    );

    const cantidadActual = existente
      ? existente.cantidad
      : 0;

    const nuevaCantidad = cantidadActual + cantidad;

    if (nuevaCantidad > stockDisponible(idProducto)) {
      mostrarAviso(
        `Existencias insuficientes. Disponibles para esta venta: ${
          stockDisponible(idProducto)
        }`
      );

      return;
    }

    if (existente) {
      existente.cantidad = nuevaCantidad;
    } else {
      carritoEdicion.push({
        id_producto: idProducto,
        nombre: producto.nombre,
        precio: Number(producto.precio),
        cantidad
      });
    }

    elCantidad.value = 1;

    renderizarDetalles();
    llenarSelectProductos();
  });

  // ----------------------------------------------------------
  // CAMBIAR CANTIDAD DE UN PRODUCTO
  // ----------------------------------------------------------

  elDetalles.addEventListener("change", event => {
    const input = event.target.closest("[data-cantidad-indice]");

    if (!input) return;

    const indice = Number(input.dataset.cantidadIndice);
    const nuevaCantidad = Number(input.value);
    const item = carritoEdicion[indice];

    if (!item) return;

    if (
      !Number.isInteger(nuevaCantidad) ||
      nuevaCantidad <= 0
    ) {
      mostrarAviso(
        "La cantidad debe ser un número entero mayor que cero."
      );

      renderizarDetalles();
      return;
    }

    if (nuevaCantidad > stockDisponible(item.id_producto)) {
      mostrarAviso(
        `No hay existencias suficientes. Disponibles: ${
          stockDisponible(item.id_producto)
        }`
      );

      renderizarDetalles();
      return;
    }

    item.cantidad = nuevaCantidad;

    renderizarDetalles();
    llenarSelectProductos();
  });

  // ----------------------------------------------------------
  // QUITAR PRODUCTO DE LA VENTA
  // ----------------------------------------------------------

  elDetalles.addEventListener("click", event => {
    const boton = event.target.closest("[data-quitar-indice]");

    if (!boton) return;

    const indice = Number(boton.dataset.quitarIndice);

    carritoEdicion.splice(indice, 1);

    renderizarDetalles();
    llenarSelectProductos();
  });

  // ----------------------------------------------------------
  // GUARDAR CAMBIOS EN SUPABASE
  // ----------------------------------------------------------

  async function guardarEdicion() {
    if (!ventaActual) {
      mostrarAviso("Primero selecciona una venta.");
      return;
    }

    if (!elCliente.value) {
      mostrarAviso("Selecciona un cliente.");
      return;
    }

    if (!elMetodo.value) {
      mostrarAviso("Selecciona un método de pago.");
      return;
    }

    if (carritoEdicion.length === 0) {
      mostrarAviso("La venta debe tener al menos un producto.");
      return;
    }

    // Validación de cantidades y existencias antes de guardar.
    for (const item of carritoEdicion) {
      if (
        !Number.isInteger(Number(item.cantidad)) ||
        Number(item.cantidad) <= 0 ||
        Number(item.cantidad) > stockDisponible(item.id_producto)
      ) {
        mostrarAviso(
          `Revisa las existencias de ${item.nombre}.`
        );

        return;
      }
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = "Guardando cambios...";

    try {
      const items = carritoEdicion.map(item => ({
        id_producto: Number(item.id_producto),
        cantidad: Number(item.cantidad)
      }));

      const { data, error } = await db.rpc("editar_venta", {
        p_id_venta: Number(ventaActual.identificacion),
        p_id_cliente: Number(elCliente.value),
        p_metodo_pago: elMetodo.value,
        p_items: items
      });

      if (error) throw error;

      if (!data || data.success !== true) {
        throw new Error(
          "Supabase no confirmó la actualización."
        );
      }

      mostrarAviso(
        `Venta actualizada. Total: ${dinero(data.total)}`
      );

      cerrarEditor();

      await cargarHistorial();

      // Actualizar las demás tablas si existen en la página.
      await cargarTablasAutomaticamente();

    } catch (error) {
      console.error("Error al editar venta:", error);

      mostrarAviso(
        "No se pudo actualizar la venta: " +
        (error.message || error)
      );

    } finally {
      btnGuardar.disabled = false;
      btnGuardar.textContent = "Guardar cambios";
    }
  }

  btnGuardar.addEventListener("click", guardarEdicion);

  btnCerrar.addEventListener("click", cerrarEditor);
  btnCancelar.addEventListener("click", cerrarEditor);

  // Cargar el historial al iniciar la página.
  await cargarHistorial();
}

// ============================================================
// 8. INICIALIZACIÓN GENERAL
// ============================================================

document.addEventListener("DOMContentLoaded", async function() {
  const conectado = await probarConexion();

  if (conectado) {
    await cargarTablasAutomaticamente();

    await inicializarModuloVentas();

    // IMPORTANTE: activa el módulo de edición en ventas.html.
    await inicializarModuloEdicionVentas();

  } else {
    mostrarAviso("No se pudo conectar con la base de datos.");
  }

  // ----------------------------------------------------------
  // A) REGISTRAR PRODUCTOS
  // ----------------------------------------------------------

  const formRegistrar = document.getElementById(
    "form-registrar-producto"
  );

  if (formRegistrar) {
    formRegistrar.addEventListener("submit", async function(event) {
      event.preventDefault();

      if (!db) {
        mostrarAviso("Esperando conexión con la base de datos...");
        return;
      }

      const btnSubmit = formRegistrar.querySelector(
        'button[type="submit"]'
      );

      btnSubmit.disabled = true;
      btnSubmit.textContent = "Guardando...";

      try {
        const siguienteId = await obtenerSiguienteId("productos");

        const precioVal = aNumero(
          document.getElementById("precio").value
        );

        const continuoVal = parseInt(
          document.getElementById("cant").value,
          10
        ) || 0;

        const elTipo = document.getElementById("tipo_producto");
        const elMarca = document.getElementById("marca");
        const elModelo = document.getElementById("modelo");

        const nuevoProducto = {
          identificacion: siguienteId,
          numserie: document.getElementById("codigo").value.trim(),
          nombre: document.getElementById("nombre").value.trim(),
          precio: precioVal,
          continuo: continuoVal,
          total_parcial: precioVal * continuoVal,
          tipo_producto: elTipo ? elTipo.value.trim() : null,
          marca: elMarca ? elMarca.value.trim() : null,
          modelo: elModelo ? elModelo.value.trim() : null
        };

        const { error } = await db
          .from("productos")
          .insert([nuevoProducto]);

        if (error) throw error;

        mostrarAviso(
          formRegistrar.getAttribute("data-aviso") ||
          "Producto guardado"
        );

        const destino = formRegistrar.getAttribute("data-destino");

        if (destino) {
          setTimeout(() => {
            location.href = destino;
          }, 900);
        }

      } catch (error) {
        console.error("Error registrando producto:", error);

        mostrarAviso(
          "Error: " + (error.message || error)
        );

        btnSubmit.disabled = false;
        btnSubmit.textContent = "Guardar";
      }
    });
  }

  // ----------------------------------------------------------
  // B) FORMULARIOS DEMO
  // ----------------------------------------------------------

  document
    .querySelectorAll(
      "form[data-aviso]:not(#form-registrar-producto)"
    )
    .forEach(formulario => {
      formulario.addEventListener("submit", function(event) {
        event.preventDefault();

        mostrarAviso(
          formulario.getAttribute("data-aviso")
        );

        const destino = formulario.getAttribute("data-destino");

        if (destino) {
          setTimeout(() => {
            location.href = destino;
          }, 900);
        }
      });
    });

  // ----------------------------------------------------------
  // C) CONSULTA DE EXISTENCIAS
  // ----------------------------------------------------------

  const formBusqueda = document.getElementById("form-busqueda");

  if (formBusqueda) {
    const caja = document.getElementById("resultado");

    formBusqueda.addEventListener("submit", async function(event) {
      event.preventDefault();

      if (!db) {
        caja.innerHTML = `
          <p class="sin-resultados">
            Conectando con la base de datos, intenta de nuevo...
          </p>
        `;

        return;
      }

      const busqueda = document
        .getElementById("buscar")
        .value.trim();

      caja.innerHTML = "<p>Buscando en inventario...</p>";

      let consulta = db
        .from("productos")
        .select("*");

      if (busqueda) {
        const termino = busqueda.replace(/[%(),]/g, "");

        consulta = consulta.or(
          `nombre.ilike.%${termino}%,` +
          `numserie.ilike.%${termino}%,` +
          `marca.ilike.%${termino}%,` +
          `modelo.ilike.%${termino}%`
        );
      }

      const { data: productos, error } = await consulta.limit(1);

      if (error) {
        caja.innerHTML = `
          <p class="sin-resultados">
            Error al consultar Supabase:
            ${escaparHTML(error.message)}
          </p>
        `;

        return;
      }

      if (!productos || productos.length === 0) {
        caja.innerHTML = `
          <p class="sin-resultados">
            No se encontró ningún producto con
            “${escaparHTML(busqueda)}”.
          </p>
        `;

        return;
      }

      const producto = productos[0];

      const stock = Number(producto.continuo ?? 0);

      const estado = stock === 0
        ? ["no", "No disponible"]
        : stock <= 3
          ? ["poco", "Por agotarse"]
          : ["ok", "Disponible"];

      caja.innerHTML = `
        <dl class="ficha">

          <div class="dato">
            <dt>Nombre</dt>
            <dd>${escaparHTML(producto.nombre || "Sin nombre")}</dd>
          </div>

          ${
            producto.marca
              ? `
                <div class="dato">
                  <dt>Marca / Modelo</dt>
                  <dd>
                    ${escaparHTML(producto.marca)}
                    ${escaparHTML(producto.modelo || "")}
                  </dd>
                </div>
              `
              : ""
          }

          <div class="dato">
            <dt>Precio</dt>
            <dd>${dinero(producto.precio)}</dd>
          </div>

          <div class="dato">
            <dt>Núm. Serie</dt>
            <dd>${escaparHTML(producto.numserie || "N/A")}</dd>
          </div>

          <div class="dato">
            <dt>Existencia (Continuo)</dt>
            <dd>
              <span class="estado estado--${estado[0]}">
                ${estado[1]} (${stock})
              </span>
            </dd>
          </div>

        </dl>
      `;
    });
  }
});
