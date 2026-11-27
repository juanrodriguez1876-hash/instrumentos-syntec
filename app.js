/* =====================================================
   INSTRUMENTOS SINTEK
   Aplicación conectada a Supabase
   ===================================================== */

// 1. CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = "https://phgozpmwgtbdiwzbbvcm.supabase.co";
const SUPABASE_KEY = "sb_publishable_xGK8x1qxR8s_LjP3tcy6zA_62wPGS4o";

let db = null;

// 2. INICIALIZAR SUPABASE Y UTILIDADES
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
    script.onerror = () => reject(new Error("No se pudo cargar la librería de Supabase"));
    document.head.appendChild(script);
  });
}

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
    console.log("Conexión exitosa con Supabase ✅");
    return true;
  } catch (err) {
    console.error("Error inicializando Supabase:", err);
    return false;
  }
}

function mostrarAviso(texto) {
  const a = document.createElement("div");
  a.className = "aviso-flotante";
  a.setAttribute("role", "status");
  a.textContent = texto;
  document.body.appendChild(a);
  setTimeout(() => a.remove(), 2500);
}

function aNumero(val) {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const limpio = parseFloat(String(val || 0).replace(/[^0-9.-]+/g, ""));
  return isNaN(limpio) ? 0 : limpio;
}

function dinero(n) {
  return "$" + aNumero(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escaparHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function obtenerSiguienteId(tabla) {
  const { data, error } = await db
    .from(tabla)
    .select("identificacion")
    .order("identificacion", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return 1;
  return Number(data[0].identificacion) + 1;
}

// 3. LLENADO AUTOMÁTICO DE TABLAS DE INVENTARIO Y VENTAS
async function cargarTablasAutomaticamente() {
  if (!db) return;

  const tablas = document.querySelectorAll("table:not(#tabla-carrito-venta)");
  if (tablas.length === 0) return;

  const pagina = location.pathname.toLowerCase();

  for (const tabla of tablas) {
    const thead = tabla.querySelector("thead");
    let tbody = tabla.querySelector("tbody");
    if (!tbody) {
      tbody = document.createElement("tbody");
      tabla.appendChild(tbody);
    }

    const encabezados = thead
      ? Array.from(thead.querySelectorAll("th")).map(th => th.textContent.trim().toLowerCase())
      : [];

    const esTablaVentas =
      pagina.includes("reporte") ||
      pagina.includes("venta") ||
      encabezados.some(h => h.includes("venta") || h.includes("cliente") || h.includes("fecha"));

    if (esTablaVentas) {
      const { data: ventas, error } = await db
        .from("ventas")
        .select(`
          identificacion,
          numventa,
          fecha,
          clientes ( nombre, correo ),
          detalle_ventas ( cantidad, precio, total_parcial, detalle, productos ( nombre, numserie ) )
        `)
        .order("identificacion", { ascending: false });

      if (error) {
        console.error("Error cargando ventas:", error.message);
        continue;
      }

      if (!ventas || ventas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${encabezados.length || 5}" style="text-align:center;">No hay ventas registradas en Supabase.</td></tr>`;
        continue;
      }

      tbody.innerHTML = ventas.map(v => {
        const cliente = v.clientes ? v.clientes.nombre : "Público general";
        const detalles = v.detalle_ventas || [];

        const subtotalVenta = detalles.reduce((acc, d) => {
          const importeLinea = aNumero(d.total_parcial) || (aNumero(d.cantidad) * aNumero(d.precio));
          return acc + importeLinea;
        }, 0);
        const totalConIva = subtotalVenta * 1.16;

        const resumenProductos = detalles
          .map(d => `${d.productos?.nombre || d.detalle || 'Producto'} (x${d.cantidad})`)
          .join(", ") || "Sin detalle";

        if (encabezados.length > 0) {
          return `<tr>${encabezados.map(h => {
            if (h.includes("num") || h.includes("folio") || h.includes("id")) return `<td>#${v.numventa || v.identificacion}</td>`;
            if (h.includes("fecha")) return `<td>${escaparHTML(v.fecha || "-")}</td>`;
            if (h.includes("cliente")) return `<td>${escaparHTML(cliente)}</td>`;
            if (h.includes("producto") || h.includes("detalle") || h.includes("concepto")) return `<td>${escaparHTML(resumenProductos)}</td>`;
            if (h.includes("subtotal")) return `<td>${dinero(subtotalVenta)}</td>`;
            if (h.includes("iva")) return `<td>${dinero(subtotalVenta * 0.16)}</td>`;
            if (h.includes("total") || h.includes("importe") || h.includes("monto") || h.includes("precio")) {
              return `<td><strong>${dinero(totalConIva)}</strong></td>`;
            }
            return `<td>-</td>`;
          }).join("")}</tr>`;
        }

        return `<tr>
          <td>#${v.numventa || v.identificacion}</td>
          <td>${escaparHTML(v.fecha || "-")}</td>
          <td>${escaparHTML(cliente)}</td>
          <td>${escaparHTML(resumenProductos)}</td>
          <td><strong>${dinero(totalConIva)}</strong></td>
        </tr>`;
      }).join("");

      continue;
    }

    // Tablas de productos / inventario / existencias
    const { data: productos, error } = await db
      .from("productos")
      .select("*")
      .order("identificacion", { ascending: true });

    if (error) {
      console.error("Error cargando productos:", error.message);
      continue;
    }

    if (!productos || productos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${encabezados.length || 5}" style="text-align:center;">No hay productos registrados en Supabase.</td></tr>`;
      continue;
    }

    tbody.innerHTML = productos.map(p => {
      const stock = Number(p.continuo ?? 0);
      const precio = aNumero(p.precio);
      const est = stock === 0 ? ["no", "No disponible"] : (stock <= 3 ? ["poco", "Por agotarse"] : ["ok", "Disponible"]);
      const badgeEstado = `<span class="estado estado--${est[0]}">${est[1]}</span>`;

      if (encabezados.length > 0) {
        return `<tr>${encabezados.map(h => {
          if (h.includes("código") || h.includes("codigo") || h.includes("serie")) return `<td>${escaparHTML(p.numserie || p.identificacion)}</td>`;
          if (h.includes("id")) return `<td>${p.identificacion}</td>`;
          if (h.includes("nombre") || h.includes("producto") || h.includes("instrumento")) return `<td>${escaparHTML(p.nombre || "-")}</td>`;
          if (h.includes("marca")) return `<td>${escaparHTML(p.marca || "-")}</td>`;
          if (h.includes("modelo")) return `<td>${escaparHTML(p.modelo || "-")}</td>`;
          if (h.includes("tipo") || h.includes("categor")) return `<td>${escaparHTML(p.tipo_producto || "-")}</td>`;
          if (h.includes("total")) return `<td>${dinero(p.total_parcial ?? (precio * stock))}</td>`;
          if (h.includes("precio") || h.includes("costo")) return `<td>${dinero(precio)}</td>`;
          if (h.includes("stock") || h.includes("existencia") || h.includes("cant") || h.includes("disponible")) return `<td>${stock}</td>`;
          if (h.includes("estado") || h.includes("estatus")) return `<td>${badgeEstado}</td>`;
          if (h.includes("acción") || h.includes("accion") || h.includes("opci")) {
            return `<td><button type="button" class="boton boton--contorno" onclick="eliminarProducto(${p.identificacion})">Eliminar</button></td>`;
          }
          return `<td>-</td>`;
        }).join("")}</tr>`;
      }

      return `<tr>
        <td>${escaparHTML(p.numserie || p.identificacion)}</td>
        <td>${escaparHTML(p.nombre || "-")}</td>
        <td>${dinero(precio)}</td>
        <td>${stock}</td>
        <td>${badgeEstado}</td>
      </tr>`;
    }).join("");
  }
}

window.eliminarProducto = async function (identificacion) {
  if (!confirm("¿Seguro que deseas eliminar este producto de Supabase?")) return;
  const { error } = await db.from("productos").delete().eq("identificacion", identificacion);
  if (error) {
    mostrarAviso("No se pudo eliminar: " + error.message);
    return;
  }
  mostrarAviso("Producto eliminado");
  await cargarTablasAutomaticamente();
};

// 4. MÓDULO DE REGISTRAR VENTA (registrar-venta.html)
async function inicializarModuloVentas() {
  const vistaVenta = document.getElementById("vista-registrar-venta");
  if (!vistaVenta || !db) return;

  const inputFolio = document.getElementById("folio");
  const inputFecha = document.getElementById("fecha");
  const selectCliente = document.getElementById("select-cliente");
  const selectProducto = document.getElementById("select-producto-venta");
  const inputCant = document.getElementById("cant-producto-venta");
  const btnAgregar = document.getElementById("btn-agregar-producto");
  const tbodyCarrito = document.getElementById("tbody-carrito-venta");
  const elSubtotal = document.getElementById("venta-subtotal");
  const elIva = document.getElementById("venta-iva");
  const elTotal = document.getElementById("venta-total");
  const btnGuardarVenta = document.getElementById("btn-guardar-venta");

  let catalogoProductos = [];
  let carrito = [];

  inputFecha.value = new Date().toISOString().split("T")[0];

  const siguienteVentaId = await obtenerSiguienteId("ventas");
  inputFolio.value = 1000 + siguienteVentaId;

  const { data: clientes } = await db.from("clientes").select("*").order("identificacion", { ascending: true });
  if (clientes && clientes.length > 0) {
    selectCliente.innerHTML = clientes.map(c => `<option value="${c.identificacion}">${escaparHTML(c.nombre)}</option>`).join("");
  } else {
    selectCliente.innerHTML = `<option value="GENERAL">Público general (se creará automáticamente)</option>`;
  }

  const { data: productos } = await db.from("productos").select("*").order("nombre", { ascending: true });
  catalogoProductos = productos || [];

  if (catalogoProductos.length > 0) {
    selectProducto.innerHTML = catalogoProductos.map(p => {
      const stock = Number(p.continuo ?? 0);
      const disabled = stock <= 0 ? "disabled" : "";
      return `<option value="${p.identificacion}" ${disabled}>${escaparHTML(p.nombre)} - ${dinero(p.precio)} (Disp: ${stock})</option>`;
    }).join("");
  } else {
    selectProducto.innerHTML = `<option value="">No hay productos registrados</option>`;
  }

  function renderizarCarrito() {
    if (carrito.length === 0) {
      tbodyCarrito.innerHTML = `<tr><td colspan="5" style="text-align:center;">Agrega productos para iniciar la venta</td></tr>`;
      elSubtotal.textContent = "$0.00";
      elIva.textContent = "$0.00";
      elTotal.textContent = "$0.00";
      return;
    }

    let subtotal = 0;
    tbodyCarrito.innerHTML = carrito.map((item, idx) => {
      const importe = aNumero(item.precio) * aNumero(item.cantidad);
      subtotal += importe;
      return `<tr>
        <td>${escaparHTML(item.nombre)}</td>
        <td>${dinero(item.precio)}</td>
        <td>${item.cantidad}</td>
        <td>${dinero(importe)}</td>
        <td><button type="button" class="boton boton--contorno" onclick="quitarItemVenta(${idx})">X</button></td>
      </tr>`;
    }).join("");

    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    elSubtotal.textContent = dinero(subtotal);
    elIva.textContent = dinero(iva);
    elTotal.textContent = dinero(total);
  }

  window.quitarItemVenta = function (idx) {
    carrito.splice(idx, 1);
    renderizarCarrito();
  };

  btnAgregar.addEventListener("click", () => {
    const idProd = parseInt(selectProducto.value, 10);
    const cant = parseInt(inputCant.value, 10);

    if (!idProd || isNaN(cant) || cant <= 0) {
      mostrarAviso("Selecciona un producto y una cantidad válida");
      return;
    }

    const prod = catalogoProductos.find(p => p.identificacion === idProd);
    if (!prod) return;

    const existente = carrito.find(item => item.id_producto === idProd);
    const cantTotalSolicitada = (existente ? existente.cantidad : 0) + cant;

    if (cantTotalSolicitada > Number(prod.continuo ?? 0)) {
      mostrarAviso(`Stock insuficiente. Solo hay ${prod.continuo} disponibles`);
      return;
    }

    const precioLimpio = aNumero(prod.precio);

    if (existente) {
      existente.cantidad += cant;
    } else {
      carrito.push({
        id_producto: prod.identificacion,
        nombre: prod.nombre,
        precio: precioLimpio,
        cantidad: cant,
        stock_actual: Number(prod.continuo || 0)
      });
    }

    inputCant.value = 1;
    renderizarCarrito();
  });

  btnGuardarVenta.addEventListener("click", async () => {
    if (carrito.length === 0) {
      mostrarAviso("Agrega al menos un producto antes de continuar");
      return;
    }

    btnGuardarVenta.disabled = true;
    btnGuardarVenta.textContent = "Registrando venta...";

    try {
      let idClienteFinal = parseInt(selectCliente.value, 10);
      if (isNaN(idClienteFinal)) {
        const nuevoClienteId = await obtenerSiguienteId("clientes");
        const { error: errCliente } = await db.from("clientes").insert([{
          identificacion: nuevoClienteId,
          nombre: "Público general",
          telefono: "0000000000",
          fecha: inputFecha.value,
          correo: "general@sintek.local"
        }]);
        if (errCliente) throw errCliente;
        idClienteFinal = nuevoClienteId;
      }

      const idVenta = await obtenerSiguienteId("ventas");
      const numVenta = parseInt(inputFolio.value, 10) || idVenta;

      const { error: errVenta } = await db.from("ventas").insert([{
        identificacion: idVenta,
        id_cliente: idClienteFinal,
        numventa: numVenta,
        fecha: inputFecha.value
      }]);

      if (errVenta) throw errVenta;

      let siguienteDetalleId = await obtenerSiguienteId("detalle_ventas");

      for (const item of carrito) {
        const totalParcial = aNumero(item.precio) * aNumero(item.cantidad);

        const { error: errDetalle } = await db.from("detalle_ventas").insert([{
          identificacion: siguienteDetalleId++,
          detalle: item.nombre,
          id_venta: idVenta,
          id_producto: item.id_producto,
          cantidad: item.cantidad,
          precio: aNumero(item.precio),
          total_parcial: totalParcial
        }]);

        if (errDetalle) throw errDetalle;

        const nuevoStock = Math.max(0, item.stock_actual - item.cantidad);
        await db.from("productos")
          .update({
            continuo: nuevoStock,
            total_parcial: nuevoStock * aNumero(item.precio)
          })
          .eq("identificacion", item.id_producto);
      }

      sessionStorage.setItem("ultima_venta", JSON.stringify({
        id_venta: idVenta,
        numventa: numVenta,
        total: elTotal.textContent
      }));

      mostrarAviso("Venta #" + numVenta + " registrada correctamente");
      setTimeout(() => {
        window.location.assign("./ventas.html");
      }, 900);

    } catch (err) {
      console.error("Error al registrar la venta:", err);
      mostrarAviso("Error al guardar venta: " + (err.message || err));
      btnGuardarVenta.disabled = false;
      btnGuardarVenta.textContent = "Continuar al pago";
    }
  });
}

// 5. FORMULARIO REGISTRAR PRODUCTO (registrar-producto.html)
async function inicializarFormularioProducto() {
  const formRegistrar = document.getElementById("form-registrar-producto");
  if (!formRegistrar) return;

  formRegistrar.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!db) {
      mostrarAviso("Esperando conexión con la base de datos...");
      return;
    }

    const btnSubmit = formRegistrar.querySelector('button[type="submit"]');
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Guardando...";

    const siguienteId = await obtenerSiguienteId("productos");
    const precioVal = aNumero(document.getElementById("precio").value);
    const continuoVal = parseInt(document.getElementById("cant").value, 10) || 0;

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

    const { error } = await db.from("productos").insert([nuevoProducto]);

    if (error) {
      mostrarAviso("Error: " + error.message);
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Guardar";
      return;
    }

    mostrarAviso(formRegistrar.getAttribute("data-aviso") || "Producto guardado");
    const destino = formRegistrar.getAttribute("data-destino");
    if (destino) {
      setTimeout(() => { window.location.assign("./" + destino.replace(/^\.?\//, "")); }, 900);
    }
  });
}

function inicializarFormulariosDemo() {
  document.querySelectorAll("form[data-aviso]:not(#form-registrar-producto)").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      mostrarAviso(f.getAttribute("data-aviso"));
      const destino = f.getAttribute("data-destino");
      if (destino) {
        setTimeout(function () {
          window.location.assign("./" + destino.replace(/^\.?\//, ""));
        }, 900);
      }
    });
  });
}

// 6. BÚSQUEDA AVANZADA Y REALTIME DE EXISTENCIAS (consulta-existencia.html)
function asegurarControlesExistencias() {
  const formulario = document.getElementById("form-busqueda") || document.getElementById("form-existencias");
  const cajaResultado = document.getElementById("resultado");

  if (!formulario) return { formulario: null, cajaResultado: null };

  // Compatibilidad si el input original se llama id="buscar" en lugar de id="buscar-nombre"
  const inputBuscarOriginal = document.getElementById("buscar");
  if (inputBuscarOriginal && !document.getElementById("buscar-nombre")) {
    inputBuscarOriginal.id = "buscar-nombre";
  }

  return { formulario, cajaResultado };
}

function inicializarBusqueda() {
  const { formulario, cajaResultado } = asegurarControlesExistencias();

  if (!formulario || !cajaResultado) return;

  if (!document.getElementById("precio-minimo")) {
    const filtros = document.createElement("div");
    filtros.className = "filtros-precio-existencias";

    filtros.innerHTML = `
      <div class="campo-busqueda">
        <label for="precio-minimo">Precio mínimo</label>
        <input
          type="number"
          id="precio-minimo"
          min="0"
          step="0.01"
          placeholder="Ej. 100"
        >
      </div>

      <div class="campo-busqueda">
        <label for="precio-maximo">Precio máximo</label>
        <input
          type="number"
          id="precio-maximo"
          min="0"
          step="0.01"
          placeholder="Ej. 5000"
        >
      </div>
    `;

    formulario.insertBefore(
      filtros,
      formulario.querySelector(".acciones-busqueda") ||
      formulario.lastElementChild
    );
  }

  const inputNombre = document.getElementById("buscar-nombre");
  const inputMinimo = document.getElementById("precio-minimo");
  const inputMaximo = document.getElementById("precio-maximo");
  const btnLimpiar = document.getElementById("btn-limpiar-existencias");

  let busquedaEjecutada = false;

  async function ejecutarBusqueda() {
    if (!db) {
      cajaResultado.innerHTML = `
        <p class="sin-resultados">
          No hay conexión con Supabase.
        </p>
      `;
      return;
    }

    const nombre = inputNombre?.value.trim() || "";
    const minimoTexto = inputMinimo?.value ?? "";
    const maximoTexto = inputMaximo?.value ?? "";

    const minimo = minimoTexto === "" ? null : Number(minimoTexto);
    const maximo = maximoTexto === "" ? null : Number(maximoTexto);

    if (
      (minimo !== null && (!Number.isFinite(minimo) || minimo < 0)) ||
      (maximo !== null && (!Number.isFinite(maximo) || maximo < 0))
    ) {
      cajaResultado.innerHTML = `
        <p class="sin-resultados">
          Introduce precios válidos.
        </p>
      `;
      return;
    }

    if (minimo !== null && maximo !== null && minimo > maximo) {
      cajaResultado.innerHTML = `
        <p class="sin-resultados">
          El precio mínimo no puede ser mayor que el precio máximo.
        </p>
      `;
      return;
    }

    cajaResultado.innerHTML = `
      <p>Consultando existencias actuales...</p>
    `;

    try {
      let consulta = db.from("productos").select("*");

      if (nombre) {
        const termino = nombre.replace(/[,%()]/g, "");
        consulta = consulta.ilike("nombre", `%${termino}%`);
      }

      if (minimo !== null) {
        consulta = consulta.gte("precio", minimo);
      }

      if (maximo !== null) {
        consulta = consulta.lte("precio", maximo);
      }

      const { data: productos, error } = await consulta.order("nombre", { ascending: true });

      if (error) throw error;

      if (!productos || productos.length === 0) {
        cajaResultado.innerHTML = `
          <p class="sin-resultados">
            No se encontraron productos con los filtros seleccionados.
          </p>
        `;
        return;
      }

      const totalProductos = productos.length;
      const agotados = productos.filter(p => Number(p.continuo ?? 0) <= 0).length;
      const disponibles = totalProductos - agotados;

      cajaResultado.innerHTML = `
        <div class="resumen-busqueda">
          <p>Productos encontrados: <strong>${totalProductos}</strong></p>
          <p>Productos disponibles: <strong>${disponibles}</strong></p>
          <p>Productos agotados: <strong>${agotados}</strong></p>
        </div>

        <div class="resultados-rango">
          ${productos.map(producto => `
            <div class="ficha">
              <div class="dato">
                <dt>Producto</dt>
                <dd>${escaparHTML(producto.nombre || "Sin nombre")}</dd>
              </div>
              <div class="dato">
                <dt>Marca / Modelo</dt>
                <dd>${escaparHTML(producto.marca || "-")} ${escaparHTML(producto.modelo || "")}</dd>
              </div>
              <div class="dato">
                <dt>Precio</dt>
                <dd>${dinero(producto.precio)}</dd>
              </div>
              <div class="dato">
                <dt>Número de serie</dt>
                <dd>${escaparHTML(producto.numserie || "N/A")}</dd>
              </div>
              <div class="dato">
                <dt>Cantidad disponible</dt>
                <dd><strong>${Number(producto.continuo ?? 0)}</strong></dd>
              </div>
              <div class="dato">
                <dt>Estado</dt>
                <dd>
                  ${Number(producto.continuo ?? 0) <= 0
                    ? '<span class="estado estado--no">Sin existencias</span>'
                    : Number(producto.continuo) <= 3
                      ? '<span class="estado estado--poco">Por agotarse</span>'
                      : '<span class="estado estado--ok">Disponible</span>'
                  }
                </dd>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    } catch (error) {
      console.error("Error consultando existencias:", error);
      cajaResultado.innerHTML = `
        <p class="sin-resultados">
          Error al consultar: ${escaparHTML(error.message)}
        </p>
      `;
    }
  }

  formulario.addEventListener("submit", async function (e) {
    e.preventDefault();
    busquedaEjecutada = true;
    await ejecutarBusqueda();
  });

  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", async function () {
      if (inputNombre) inputNombre.value = "";
      if (inputMinimo) inputMinimo.value = "";
      if (inputMaximo) inputMaximo.value = "";
      busquedaEjecutada = false;
      cajaResultado.innerHTML = "";
      await cargarTablasAutomaticamente();
    });
  }

  if (db && !window.suscripcionExistencias) {
    window.suscripcionExistencias = db
      .channel("actualizacion-existencias")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "productos"
        },
        async function () {
          console.log("Cambio detectado en inventario");
          await cargarTablasAutomaticamente();
          if (busquedaEjecutada) {
            await ejecutarBusqueda();
          }
        }
      )
      .subscribe();
  }
}

// 7. INICIALIZACIÓN GENERAL
document.addEventListener("DOMContentLoaded", async function () {
  const conectado = await probarConexion();

  if (conectado) {
    await cargarTablasAutomaticamente();
    await inicializarModuloVentas();
  }

  await inicializarFormularioProducto();
  inicializarFormulariosDemo();
  inicializarBusqueda();
});