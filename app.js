/* =====================================================
   INSTRUMENTOS SINTEK
   Aplicación conectada a Supabase
   ===================================================== */

// 1. CONFIGURACIÓN DE SUPABASE

const SUPABASE_URL = "https://phgozpmwgtbdiwzbbvcm.supabase.co";
const SUPABASE_KEY = "sb_publishable_xGK8x1qxR8s_LjP3tcy6zA_62wPGS4o";

let db = null;


// 2. INICIALIZAR SUPABASE

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


// 3. FUNCIONES GENERALES

function mostrarAviso(texto) {
  const aviso = document.createElement("div");

  aviso.className = "aviso-flotante";
  aviso.setAttribute("role", "status");
  aviso.textContent = texto;

  document.body.appendChild(aviso);

  setTimeout(() => aviso.remove(), 3000);
}


function aNumero(valor) {
  if (typeof valor === "number") {
    return isNaN(valor) ? 0 : valor;
  }

  const limpio = parseFloat(
    String(valor || 0).replace(/[^0-9.-]+/g, "")
  );

  return isNaN(limpio) ? 0 : limpio;
}


function dinero(valor) {
  return "$" + aNumero(valor).toLocaleString("es-MX", {
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


// 4. COMPROBAR CONEXIÓN

async function probarConexion() {
  try {
    await inicializarSupabase();

    const { error } = await db
      .from("productos")
      .select("identificacion")
      .limit(1);

    if (error) {
      console.error("Error de conexión:", error.message);
      return false;
    }

    console.log("Conexión exitosa con Supabase");
    return true;

  } catch (error) {
    console.error("Error inicializando Supabase:", error);
    return false;
  }
}


// 5. CARGAR HISTORIAL DE VENTAS

async function cargarHistorialVentas(tabla) {

  const tbody =
    tabla.querySelector("#tabla-ventas") ||
    tabla.querySelector("tbody");

  if (!tbody) {
    console.error("No se encontró el cuerpo de la tabla de ventas");
    return;
  }

  const encabezados = tabla.querySelectorAll("thead th");

  // Asegurar que exista la columna Acciones
  const filaEncabezados = tabla.querySelector("thead tr");

  if (filaEncabezados) {
    const yaExiste = Array.from(encabezados).some(th =>
      th.textContent.toLowerCase().includes("acciones") ||
      th.textContent.toLowerCase().includes("acción")
    );

    if (!yaExiste) {
      const th = document.createElement("th");
      th.textContent = "Acciones";
      filaEncabezados.appendChild(th);
    }
  }

  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align:center;">
        Cargando ventas...
      </td>
    </tr>
  `;

  try {

    // Obtener ventas
    const { data: ventas, error: errorVentas } = await db
      .from("ventas")
      .select("*")
      .order("identificacion", { ascending: false });

    if (errorVentas) throw errorVentas;

    if (!ventas || ventas.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;">
            No hay ventas registradas.
          </td>
        </tr>
      `;
      return;
    }

    // Obtener clientes
    const { data: clientes, error: errorClientes } = await db
      .from("clientes")
      .select("*");

    if (errorClientes) throw errorClientes;

    // Obtener detalles de ventas
    const { data: detalles, error: errorDetalles } = await db
      .from("detalle_ventas")
      .select("*");

    if (errorDetalles) throw errorDetalles;

    // Obtener productos
    const { data: productos, error: errorProductos } = await db
      .from("productos")
      .select("*");

    if (errorProductos) throw errorProductos;

    // Crear filas del historial
    tbody.innerHTML = ventas.map(venta => {

      const cliente = clientes.find(c =>
        Number(c.identificacion) === Number(venta.id_cliente)
      );

      const detallesVenta = detalles.filter(d =>
        Number(d.id_venta) === Number(venta.identificacion)
      );

      let subtotal = 0;

      const nombresProductos = detallesVenta.map(detalle => {

        const producto = productos.find(p =>
          Number(p.identificacion) === Number(detalle.id_producto)
        );

        const nombre =
          producto?.nombre ||
          detalle.detalle ||
          "Producto";

        subtotal +=
          aNumero(detalle.total_parcial) ||
          aNumero(detalle.precio) * aNumero(detalle.cantidad);

        return `${escaparHTML(nombre)} (x${detalle.cantidad})`;

      }).join(", ");

      const total = subtotal * 1.16;

      return `
        <tr>
          <td>#${escaparHTML(venta.numventa || venta.identificacion)}</td>

          <td>${escaparHTML(venta.fecha || "-")}</td>

          <td>
            ${escaparHTML(cliente?.nombre || "Público general")}
          </td>

          <td>
            ${nombresProductos || "Sin productos"}
          </td>

          <td>
            <strong>${dinero(total)}</strong>
          </td>

          <td>
            <button
              type="button"
              class="boton boton--contorno"
              onclick="eliminarVenta(${Number(venta.identificacion)})">
              Eliminar venta
            </button>
          </td>
        </tr>
      `;

    }).join("");

  } catch (error) {

    console.error("Error cargando historial:", error);

    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;">
          Error al cargar las ventas: ${escaparHTML(error.message)}
        </td>
      </tr>
    `;
  }
}


// 6. CARGAR TABLAS DE INVENTARIO Y CONSULTA

function obtenerFiltroNombreTabla() {
  const inputNombre =
    document.getElementById("buscar-nombre") ||
    document.getElementById("nombre-producto") ||
    document.getElementById("buscar");

  return inputNombre ? inputNombre.value.trim() : "";
}

async function cargarTablaProductos(tabla, nombreOverride = null) {

  const tbody = tabla.querySelector("tbody");

  if (!tbody) return;

  const encabezados = Array.from(
    tabla.querySelectorAll("thead th")
  ).map(th => th.textContent.trim().toLowerCase());

  const nombre = nombreOverride !== null ? nombreOverride : obtenerFiltroNombreTabla();

  let consulta = db
    .from("productos")
    .select("*");

  if (nombre) {
    const termino = nombre.replace(/[,%()]/g, "");
    consulta = consulta.ilike("nombre", `%${termino}%`);
  }

  const { data: productos, error } = await consulta
    .order("identificacion", { ascending: true });

  if (error) {
    console.error("Error cargando productos:", error.message);
    return;
  }

  if (!productos || productos.length === 0) {
    const mensajeVacio = nombre
      ? `No hay productos con el nombre "${escaparHTML(nombre)}".`
      : "No hay productos registrados.";

    tbody.innerHTML = `
      <tr>
        <td colspan="${encabezados.length || 5}" style="text-align:center;">
          ${mensajeVacio}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = productos.map(p => {

    const stock = Number(p.continuo ?? 0);
    const precio = aNumero(p.precio);

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
          ${encabezados.map(h => {

            if (h.includes("código") || h.includes("codigo") || h.includes("serie")) {
              return `<td>${escaparHTML(p.numserie || p.identificacion)}</td>`;
            }

            if (h.includes("id")) {
              return `<td>${p.identificacion}</td>`;
            }

            if (h.includes("nombre") || h.includes("producto") || h.includes("instrumento")) {
              return `<td>${escaparHTML(p.nombre || "-")}</td>`;
            }

            if (h.includes("marca")) {
              return `<td>${escaparHTML(p.marca || "-")}</td>`;
            }

            if (h.includes("modelo")) {
              return `<td>${escaparHTML(p.modelo || "-")}</td>`;
            }

            if (h.includes("tipo") || h.includes("categor")) {
              return `<td>${escaparHTML(p.tipo_producto || "-")}</td>`;
            }

            if (h.includes("precio") || h.includes("costo")) {
              return `<td>${dinero(precio)}</td>`;
            }

            if (h.includes("total")) {
              return `<td>${dinero(p.total_parcial ?? precio * stock)}</td>`;
            }

            if (h.includes("stock") || h.includes("existencia") || h.includes("cant") || h.includes("disponible")) {
              return `<td>${stock}</td>`;
            }

            if (h.includes("estado") || h.includes("estatus")) {
              return `<td>${badgeEstado}</td>`;
            }

            if (h.includes("acción") || h.includes("accion") || h.includes("opci")) {
              return `
                <td>
                  <button
                    type="button"
                    class="boton boton--contorno"
                    onclick="eliminarProducto(${Number(p.identificacion)})">
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
        <td>${escaparHTML(p.numserie || p.identificacion)}</td>
        <td>${escaparHTML(p.nombre || "-")}</td>
        <td>${dinero(precio)}</td>
        <td>${stock}</td>
        <td>${badgeEstado}</td>
      </tr>
    `;

  }).join("");
}


// 7. CARGAR TODAS LAS TABLAS AUTOMÁTICAMENTE

async function cargarTablasAutomaticamente() {

  if (!db) return;

  const tablas = document.querySelectorAll(
    "table:not(#tabla-carrito-venta)"
  );

  const pagina = location.pathname.toLowerCase();

  for (const tabla of tablas) {

    const esHistorialVentas =
      pagina.includes("ventas") ||
      pagina.includes("venta") ||
      pagina.includes("reporte") ||
      tabla.id === "tabla-ventas" ||
      tabla.querySelector("#tabla-ventas") !== null ||
      tabla.getAttribute("data-tipo") === "ventas";

    if (esHistorialVentas) {
      await cargarHistorialVentas(tabla);
    } else {
      await cargarTablaProductos(tabla);
    }
  }
}


// 8. ELIMINAR PRODUCTO

window.eliminarProducto = async function (identificacion) {

  if (!db) {
    mostrarAviso("No hay conexión con Supabase");
    return;
  }

  const confirmar = confirm(
    "¿Estás seguro de eliminar este producto?"
  );

  if (!confirmar) return;

  try {

    const { error } = await db
      .from("productos")
      .delete()
      .eq("identificacion", identificacion);

    if (error) throw error;

    mostrarAviso("Producto eliminado correctamente");

    await cargarTablasAutomaticamente();

  } catch (error) {

    console.error("Error eliminando producto:", error);
    mostrarAviso("No se pudo eliminar: " + error.message);
  }
};


// 9. ELIMINAR VENTA Y RESTAURAR INVENTARIO

window.eliminarVenta = async function (identificacion) {

  const idVenta = Number(identificacion);

  if (!Number.isInteger(idVenta) || idVenta <= 0) {
    mostrarAviso("No se pudo identificar la venta");
    return;
  }

  if (!db) {
    mostrarAviso("No hay conexión con Supabase");
    return;
  }

  const confirmar = confirm(
    "¿Estás seguro de eliminar esta venta?\n\n" +
    "Se eliminarán sus detalles y se devolverán los productos al inventario."
  );

  if (!confirmar) return;

  try {

    const { error } = await db.rpc("eliminar_venta", {
      p_id_venta: idVenta
    });

    if (error) throw error;

    mostrarAviso("Venta eliminada y existencias restauradas");

    await cargarTablasAutomaticamente();

  } catch (error) {

    console.error("Error eliminando venta:", error);

    mostrarAviso(
      "No se pudo eliminar la venta: " + error.message
    );
  }
};


// 10. MÓDULO DE REGISTRO DE VENTAS

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

  if (
    !inputFolio ||
    !inputFecha ||
    !selectCliente ||
    !selectProducto ||
    !inputCant ||
    !btnAgregar ||
    !tbodyCarrito ||
    !elSubtotal ||
    !elIva ||
    !elTotal ||
    !btnGuardarVenta
  ) {
    console.error("Faltan elementos HTML en el módulo de ventas");
    return;
  }

  let catalogoProductos = [];
  let carrito = [];

  inputFecha.value = new Date().toISOString().split("T")[0];

  const siguienteVentaId = await obtenerSiguienteId("ventas");

  inputFolio.value = 1000 + siguienteVentaId;


  // Cargar clientes

  const { data: clientes, error: errorClientes } = await db
    .from("clientes")
    .select("*")
    .order("identificacion", { ascending: true });

  if (errorClientes) {
    mostrarAviso("Error al cargar clientes");
    console.error(errorClientes);
    return;
  }

  if (clientes && clientes.length > 0) {

    selectCliente.innerHTML = clientes.map(c => `
      <option value="${c.identificacion}">
        ${escaparHTML(c.nombre)}
      </option>
    `).join("");

  } else {

    selectCliente.innerHTML = `
      <option value="GENERAL">
        Público general
      </option>
    `;
  }


  // Cargar productos

  const { data: productos, error: errorProductos } = await db
    .from("productos")
    .select("*")
    .order("nombre", { ascending: true });

  if (errorProductos) {
    mostrarAviso("Error al cargar productos");
    console.error(errorProductos);
    return;
  }

  catalogoProductos = productos || [];

  if (catalogoProductos.length > 0) {

    selectProducto.innerHTML = catalogoProductos.map(p => {

      const stock = Number(p.continuo ?? 0);

      return `
        <option
          value="${p.identificacion}"
          ${stock <= 0 ? "disabled" : ""}>
          ${escaparHTML(p.nombre)} -
          ${dinero(p.precio)}
          (Disponible: ${stock})
        </option>
      `;

    }).join("");

  } else {

    selectProducto.innerHTML = `
      <option value="">No hay productos registrados</option>
    `;
  }


  // Mostrar carrito

  function renderizarCarrito() {

    if (carrito.length === 0) {

      tbodyCarrito.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;">
            Agrega productos para iniciar la venta
          </td>
        </tr>
      `;

      elSubtotal.textContent = dinero(0);
      elIva.textContent = dinero(0);
      elTotal.textContent = dinero(0);

      return;
    }

    let subtotal = 0;

    tbodyCarrito.innerHTML = carrito.map((item, indice) => {

      const importe = aNumero(item.precio) * item.cantidad;

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
              onclick="quitarItemVenta(${indice})">
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


  // Quitar producto del carrito

  window.quitarItemVenta = function (indice) {

    carrito.splice(indice, 1);

    renderizarCarrito();
  };


  // Agregar producto al carrito

  btnAgregar.addEventListener("click", () => {

    const idProducto = Number(selectProducto.value);
    const cantidad = parseInt(inputCant.value, 10);

    if (!idProducto || !Number.isInteger(cantidad) || cantidad <= 0) {
      mostrarAviso("Selecciona un producto y una cantidad válida");
      return;
    }

    const producto = catalogoProductos.find(p =>
      Number(p.identificacion) === idProducto
    );

    if (!producto) {
      mostrarAviso("Producto no encontrado");
      return;
    }

    const existente = carrito.find(item =>
      item.id_producto === idProducto
    );

    const cantidadSolicitada =
      (existente ? existente.cantidad : 0) + cantidad;

    if (cantidadSolicitada > Number(producto.continuo ?? 0)) {
      mostrarAviso(
        "Stock insuficiente. Disponibles: " + producto.continuo
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
        cantidad: cantidad,
        stock_actual: Number(producto.continuo ?? 0)
      });
    }

    inputCant.value = 1;

    renderizarCarrito();
  });


  // Guardar venta

  btnGuardarVenta.addEventListener("click", async () => {

    if (carrito.length === 0) {
      mostrarAviso("Agrega al menos un producto");
      return;
    }

    btnGuardarVenta.disabled = true;
    btnGuardarVenta.textContent = "Registrando venta...";

    try {

      // Obtener o crear cliente

      let idClienteFinal = Number(selectCliente.value);

      if (!Number.isInteger(idClienteFinal)) {

        idClienteFinal = await obtenerSiguienteId("clientes");

        const { error: errorCliente } = await db
          .from("clientes")
          .insert([{
            identificacion: idClienteFinal,
            nombre: "Público general",
            telefono: "0000000000",
            fecha: inputFecha.value,
            correo: "general@sintek.local"
          }]);

        if (errorCliente) throw errorCliente;
      }


      // Crear venta

      const idVenta = await obtenerSiguienteId("ventas");

      const numVenta = parseInt(inputFolio.value, 10) || idVenta;

      const { error: errorVenta } = await db
        .from("ventas")
        .insert([{
          identificacion: idVenta,
          id_cliente: idClienteFinal,
          numventa: numVenta,
          fecha: inputFecha.value
        }]);

      if (errorVenta) throw errorVenta;


      // Registrar detalles y descontar inventario

      let siguienteDetalleId = await obtenerSiguienteId("detalle_ventas");

      for (const item of carrito) {

        const totalParcial =
          aNumero(item.precio) * aNumero(item.cantidad);

        const { error: errorDetalle } = await db
          .from("detalle_ventas")
          .insert([{
            identificacion: siguienteDetalleId,
            detalle: item.nombre,
            id_venta: idVenta,
            id_producto: item.id_producto,
            cantidad: item.cantidad,
            precio: aNumero(item.precio),
            total_parcial: totalParcial
          }]);

        if (errorDetalle) throw errorDetalle;

        siguienteDetalleId++;


        // Actualizar existencias

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


      // Guardar última venta

      sessionStorage.setItem("ultima_venta", JSON.stringify({
        id_venta: idVenta,
        numventa: numVenta,
        total: elTotal.textContent
      }));

      mostrarAviso(
        "Venta #" + numVenta + " registrada correctamente"
      );

      setTimeout(() => {
        location.href = "ventas.html";
      }, 900);

    } catch (error) {

      console.error("Error al registrar venta:", error);

      mostrarAviso(
        "Error al guardar venta: " + error.message
      );

      btnGuardarVenta.disabled = false;
      btnGuardarVenta.textContent = "Continuar al pago";
    }
  });
}


// 11. REGISTRAR PRODUCTO

async function inicializarFormularioProducto() {

  const formulario = document.getElementById("form-registrar-producto");

  if (!formulario) return;

  formulario.addEventListener("submit", async function (e) {

    e.preventDefault();

    if (!db) {
      mostrarAviso("Esperando conexión con Supabase");
      return;
    }

    const boton = formulario.querySelector('button[type="submit"]');

    if (boton) {
      boton.disabled = true;
      boton.textContent = "Guardando...";
    }

    try {

      const siguienteId = await obtenerSiguienteId("productos");

      const precio = aNumero(
        document.getElementById("precio")?.value
      );

      const cantidad = parseInt(
        document.getElementById("cant")?.value,
        10
      ) || 0;

      const nuevoProducto = {
        identificacion: siguienteId,
        numserie: document.getElementById("codigo")?.value.trim(),
        nombre: document.getElementById("nombre")?.value.trim(),
        precio: precio,
        continuo: cantidad,
        total_parcial: precio * cantidad,
        tipo_producto: document.getElementById("tipo_producto")?.value.trim() || null,
        marca: document.getElementById("marca")?.value.trim() || null,
        modelo: document.getElementById("modelo")?.value.trim() || null
      };

      const { error } = await db
        .from("productos")
        .insert([nuevoProducto]);

      if (error) throw error;

      mostrarAviso(
        formulario.getAttribute("data-aviso") || "Producto guardado correctamente"
      );

      const destino = formulario.getAttribute("data-destino");

      if (destino) {
        setTimeout(() => {
          location.href = destino;
        }, 900);
      } else if (boton) {
        boton.disabled = false;
        boton.textContent = "Guardar";
      }

    } catch (error) {

      console.error("Error guardando producto:", error);

      mostrarAviso("Error: " + error.message);

      if (boton) {
        boton.disabled = false;
        boton.textContent = "Guardar";
      }
    }
  });
}


// 12. FORMULARIOS DEMO

function inicializarFormulariosDemo() {

  document.querySelectorAll(
    "form[data-aviso]:not(#form-registrar-producto)"
  ).forEach(formulario => {

    formulario.addEventListener("submit", function (e) {

      e.preventDefault();

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
}


// 13. CONSULTAR EXISTENCIAS POR NOMBRE (ISSUE-015)

function renderizarFichaProducto(producto) {
  const stock = Number(producto.continuo ?? 0);

  const estado = stock === 0
    ? ["no", "Sin existencias"]
    : stock <= 3
      ? ["poco", "Existencias bajas"]
      : ["ok", "Disponible"];

  return `
    <article class="producto-resultado">
      <div class="producto-resultado__informacion">
        <h3>${escaparHTML(producto.nombre || "Producto sin nombre")}</h3>
        <p><strong>Código:</strong> ${escaparHTML(producto.numserie || "No registrado")}</p>
        <p><strong>Precio:</strong> ${dinero(producto.precio)}</p>
        <p><strong>Existencias:</strong> ${stock}</p>
      </div>

      <div class="producto-resultado__acciones">
        <span class="estado estado--${estado[0]}">${estado[1]}</span>
        <button
          type="button"
          class="boton btn-ver-detalles"
          data-producto-id="${escaparHTML(producto.identificacion)}">
          Ver detalles
        </button>
      </div>
    </article>
  `;
}

function renderizarDetalleProducto(producto) {
  const stock = Number(producto.continuo ?? 0);

  const estado = stock === 0
    ? ["no", "Sin existencias"]
    : stock <= 3
      ? ["poco", "Existencias bajas"]
      : ["ok", "Disponible"];

  const nombresCampos = {
    identificacion: "Identificación del producto",
    numserie: "Código / Número de serie",
    nombre: "Nombre del producto",
    precio: "Precio",
    tipo_producto: "Categoría",
    marca: "Marca",
    modelo: "Modelo",
    continuo: "Existencias",
    total_parcial: "Valor total del inventario",
    descripcion: "Descripción",
    created_at: "Fecha de registro"
  };

  const detalles = Object.entries(producto).map(([campo, valor]) => {
    let contenido;

    if (valor === null || valor === undefined || valor === "") {
      contenido = "No registrado";
    } else if (campo === "precio" || campo === "total_parcial") {
      contenido = dinero(valor);
    } else if (campo === "continuo") {
      contenido = Number(valor).toLocaleString("es-MX");
    } else if (typeof valor === "object") {
      contenido = JSON.stringify(valor);
    } else {
      contenido = String(valor);
    }

    return `
      <div class="detalle-producto-dato">
        <dt>${escaparHTML(nombresCampos[campo] || campo)}</dt>
        <dd>${escaparHTML(contenido)}</dd>
      </div>
    `;
  }).join("");

  return `
    <section class="detalle-producto" aria-label="Detalles del producto">
      <div class="detalle-producto__encabezado">
        <div>
          <span class="detalle-producto-etiqueta">DETALLES DEL PRODUCTO</span>
          <h2>${escaparHTML(producto.nombre || "Producto sin nombre")}</h2>
          <p>Código: ${escaparHTML(producto.numserie || "No registrado")}</p>
        </div>
        <span class="estado estado--${estado[0]}">${estado[1]} (${stock})</span>
      </div>

      <div class="detalle-producto-contenido">
        <h3>Información registrada en el sistema</h3>
        <dl class="detalle-producto-lista">
          ${detalles}
        </dl>
      </div>

      <div class="acciones detalle-producto-acciones">
        <button type="button" class="boton" id="btn-regresar-resultados">
          ← Regresar a resultados
        </button>
      </div>
    </section>
  `;
}

function esPestanaExistenciasActiva() {
  if (document.body.classList.contains("pagina-login")) {
    return false;
  }

  const pagina = location.pathname.toLowerCase();
  if (
    pagina.includes("venta") ||
    pagina.includes("reporte") ||
    pagina.includes("cliente") ||
    pagina.includes("piano") ||
    pagina.includes("registrar") ||
    pagina.includes("login") ||
    pagina.includes("crear-cuenta") ||
    pagina.includes("recuperar")
  ) {
    return false;
  }

  if (
    pagina.includes("existencia") ||
    pagina.includes("inventario") ||
    document.getElementById("vista-existencias") ||
    document.getElementById("existencias")
  ) {
    return true;
  }

  const navActiva = document.querySelector('.nav[aria-current], .tab.activa, .tab.active, [aria-selected="true"]');
  if (navActiva && navActiva.textContent.toLowerCase().includes("existencia")) {
    return true;
  }

  const tituloPrincipal = document.querySelector(".superior .titulo, h1");
  if (tituloPrincipal && tituloPrincipal.textContent.toLowerCase().includes("existencia")) {
    return true;
  }

  return false;
}

function asegurarControlesExistencias() {
  let formulario = document.getElementById("form-busqueda");

  if (!esPestanaExistenciasActiva()) {
    if (formulario) {
      formulario.hidden = true;
      formulario.style.display = "none";
    }
    const cajaExistente = document.getElementById("resultado");
    if (cajaExistente) {
      cajaExistente.innerHTML = "";
    }
    return { formulario: null, cajaResultado: null };
  }

  if (formulario) {
    formulario.hidden = false;
    formulario.style.display = "";

    let cajaResultado = document.getElementById("resultado");
    if (!cajaResultado) {
      cajaResultado = document.createElement("div");
      cajaResultado.id = "resultado";
      formulario.insertAdjacentElement("afterend", cajaResultado);
    }

    if (!formulario.querySelector('button[type="submit"]')) {
      const btnSubmit = document.createElement("button");
      btnSubmit.type = "submit";
      btnSubmit.id = "btn-buscar-existencias";
      btnSubmit.className = "btn-buscar-existencias";
      btnSubmit.textContent = "Buscar";
      formulario.appendChild(btnSubmit);
    }

    return { formulario, cajaResultado };
  }

  const contenedorDestino =
    document.getElementById("vista-existencias") ||
    document.getElementById("existencias") ||
    document.getElementById("resultado")?.parentElement ||
    document.querySelector("table:not(#tabla-carrito-venta)")?.parentElement ||
    document.querySelector("main") ||
    document.body;

  formulario = document.createElement("form");
  formulario.id = "form-busqueda";
  formulario.className = "barra-busqueda-existencias";
  formulario.setAttribute("aria-label", "Buscar productos en existencias");
  formulario.innerHTML = `
    <div class="campo-busqueda campo-busqueda--nombre">
      <label for="buscar-nombre">Nombre del producto</label>
      <input
        type="search"
        id="buscar-nombre"
        name="buscar-nombre"
        placeholder="Ej. Guitarra, Piano, Bajo..."
      >
    </div>

    <div class="acciones-busqueda">
      <button type="submit" id="btn-buscar-existencias" class="btn-buscar-existencias">
        Buscar
      </button>
      <button type="button" id="btn-limpiar-existencias" class="btn-limpiar-existencias">
        Limpiar
      </button>
    </div>
  `;

  let cajaResultado = document.getElementById("resultado");
  if (!cajaResultado) {
    cajaResultado = document.createElement("div");
    cajaResultado.id = "resultado";
  }

  const tablaExistencias = contenedorDestino.querySelector("table:not(#tabla-carrito-venta)");
  if (tablaExistencias) {
    contenedorDestino.insertBefore(formulario, tablaExistencias);
    contenedorDestino.insertBefore(cajaResultado, tablaExistencias);
  } else {
    contenedorDestino.appendChild(formulario);
    contenedorDestino.appendChild(cajaResultado);
  }

  return { formulario, cajaResultado };
}

function inicializarBusqueda() {
  const { formulario, cajaResultado } = asegurarControlesExistencias();
  if (!formulario || !cajaResultado) return;

  const caja = cajaResultado;
  let productosEncontrados = [];
  let textoResumen = "";

  // Añadir el botón Limpiar si esta página todavía no lo tiene.
  let btnLimpiar = document.getElementById("btn-limpiar-existencias");
  if (!btnLimpiar) {
    btnLimpiar = document.createElement("button");
    btnLimpiar.type = "button";
    btnLimpiar.id = "btn-limpiar-existencias";
    btnLimpiar.className = "boton boton--contorno";
    btnLimpiar.textContent = "Limpiar";
    const btnBuscar = formulario.querySelector('button[type="submit"]');
    if (btnBuscar) {
      btnBuscar.insertAdjacentElement("afterend", btnLimpiar);
    } else {
      formulario.appendChild(btnLimpiar);
    }
  }

  function mostrarResultados() {
    caja.innerHTML = `
      <p class="resumen-busqueda">${textoResumen}</p>
      <div class="lista-resultados">
        ${productosEncontrados.map(renderizarFichaProducto).join("")}
      </div>
    `;
  }

  formulario.addEventListener("submit", async function(e) {
    e.preventDefault();

    const inputBusqueda =
      document.getElementById("buscar-nombre") ||
      document.getElementById("nombre-producto") ||
      document.getElementById("buscar");

    const termino = inputBusqueda ? inputBusqueda.value.trim() : "";
    const botonBuscar = formulario.querySelector('button[type="submit"]');

    if (!db) {
      caja.innerHTML = '<p class="sin-resultados">No hay conexión con Supabase.</p>';
      return;
    }

    if (botonBuscar) {
      botonBuscar.disabled = true;
      botonBuscar.textContent = "Buscando...";
    }
    caja.innerHTML = '<p>Buscando productos...</p>';

    try {
      let encontrados = [];

      if (!termino) {
        const { data, error } = await db
          .from("productos")
          .select("*")
          .order("nombre", { ascending: true });

        if (error) throw error;
        encontrados = data || [];
      } else {
        // Consultar nombre y código por separado para evitar problemas
        // con caracteres especiales en los filtros de Supabase.
        const terminoSeguro = termino.replace(/[%_,()]/g, " ").trim();
        const consultas = await Promise.all([
          db.from("productos")
            .select("*")
            .ilike("nombre", `%${terminoSeguro}%`)
            .order("nombre", { ascending: true }),
          db.from("productos")
            .select("*")
            .ilike("numserie", `%${terminoSeguro}%`)
            .order("nombre", { ascending: true })
        ]);

        for (const resultado of consultas) {
          if (resultado.error) throw resultado.error;
          encontrados.push(...(resultado.data || []));
        }

        // Si se escribió un número, también buscar por identificación exacta.
        if (/^\d+$/.test(termino)) {
          const { data, error } = await db
            .from("productos")
            .select("*")
            .eq("identificacion", Number(termino));

          if (error) throw error;
          encontrados.push(...(data || []));
        }

        // Quitar duplicados cuando el producto coincide por nombre y código.
        encontrados = Array.from(
          new Map(encontrados.map(p => [String(p.identificacion), p])).values()
        ).sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"));
      }

      productosEncontrados = encontrados;

      if (productosEncontrados.length === 0) {
        caja.innerHTML = `
          <p class="sin-resultados">
            No se encontraron productos${termino ? ` para "${escaparHTML(termino)}"` : ""}.
          </p>
        `;
        return;
      }

      textoResumen = `Se encontraron <strong>${productosEncontrados.length}</strong> producto(s). Selecciona uno para consultar toda su información.`;
      mostrarResultados();

    } catch (error) {
      console.error("Error en búsqueda de productos:", error);
      caja.innerHTML = `
        <p class="sin-resultados">
          Error al consultar productos: ${escaparHTML(error.message)}
        </p>
      `;
    } finally {
      if (botonBuscar) {
        botonBuscar.disabled = false;
        botonBuscar.textContent = "Buscar";
      }
    }
  });

  // Selección de producto y regreso a los resultados.
  caja.addEventListener("click", async function(e) {
    const botonDetalles = e.target.closest(".btn-ver-detalles");

    if (botonDetalles) {
      const idProducto = botonDetalles.getAttribute("data-producto-id");
      if (!idProducto) return;

      botonDetalles.disabled = true;
      botonDetalles.textContent = "Cargando...";

      try {
        // Consultar nuevamente el registro para mostrar datos actuales.
        const { data: producto, error } = await db
          .from("productos")
          .select("*")
          .eq("identificacion", Number(idProducto))
          .single();

        if (error) throw error; 
        if (!producto) throw new Error("No se encontró el producto.");

        caja.innerHTML = renderizarDetalleProducto(producto);
      } catch (error) {
        console.error("Error al cargar los detalles:", error);
        mostrarAviso("No se pudieron cargar los detalles del producto.");
        botonDetalles.disabled = false;
        botonDetalles.textContent = "Ver detalles";
      }
      return;
    }

    if (e.target.closest("#btn-regresar-resultados")) {
      mostrarResultados();
    }
  });

  // Limpiar búsqueda y resultados.
  btnLimpiar.addEventListener("click", function() {
    const inputBusqueda =
      document.getElementById("buscar-nombre") ||
      document.getElementById("nombre-producto") ||
      document.getElementById("buscar");

    if (inputBusqueda) inputBusqueda.value = "";
    productosEncontrados = [];
    textoResumen = "";
    caja.innerHTML = `
      <p class="sin-resultados">
        Escribe el nombre, código o identificación de un producto para consultar el inventario.
      </p>
    `;
  });
}


// 14. INICIALIZACIÓN GENERAL

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