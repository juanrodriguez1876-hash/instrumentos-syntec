/* app.js · Conectado estrictamente al esquema real de Supabase + Llenado automático de tablas */

// 1. CONFIGURACIÓN Y LLAVES DE SUPABASE
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
    script.onerror = () => reject(new Error("No se pudo cargar la librería de Supabase"));
    document.head.appendChild(script);
  });
}

function mostrarAviso(texto) {
  const a = document.createElement("div");
  a.className = "aviso-flotante";
  a.setAttribute("role", "status");
  a.textContent = texto;
  document.body.appendChild(a);
  setTimeout(() => a.remove(), 2500);
}

function dinero(n) {
  return "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 });
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

// 2. COMPROBAR CONEXIÓN
async function probarConexion() {
  try {
    await inicializarSupabase();
    const { data, error } = await db
      .from("productos")
      .select("identificacion, numserie, nombre, precio, continuo")
      .limit(5);

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

// 3. LLENADO AUTOMÁTICO DE TODAS LAS TABLAS HTML DEL PROYECTO
async function cargarTablasAutomaticamente() {
  if (!db) return;

  const tablas = document.querySelectorAll("table");
  if (tablas.length === 0) return;

  const pagina = location.pathname.toLowerCase();

  for (const tabla of tablas) {
    const thead = tabla.querySelector("thead");
    let tbody = tabla.querySelector("tbody");
    if (!tbody) {
      tbody = document.createElement("tbody");
      tabla.appendChild(tbody);
    }

    // Leer los títulos de las columnas de la tabla HTML actual
    const encabezados = thead
      ? Array.from(thead.querySelectorAll("th")).map(th => th.textContent.trim().toLowerCase())
      : [];

    // Detectar si la tabla corresponde a VENTAS / REPORTES
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
        const totalVenta = detalles.reduce((acc, d) => acc + Number(d.total_parcial || (d.cantidad * d.precio) || 0), 0);
        const resumenProductos = detalles.map(d => `${d.productos?.nombre || d.detalle || 'Producto'} (x${d.cantidad})`).join(", ") || "Sin detalle";

        // Ajustar columnas dinámicamente según los <th> de la pantalla
        if (encabezados.length > 0) {
          return `<tr>${encabezados.map(h => {
            if (h.includes("num") || h.includes("folio") || h.includes("id")) return `<td>${v.numventa || v.identificacion}</td>`;
            if (h.includes("fecha")) return `<td>${v.fecha || "-"}</td>`;
            if (h.includes("cliente")) return `<td>${cliente}</td>`;
            if (h.includes("producto") || h.includes("detalle") || h.includes("concepto")) return `<td>${resumenProductos}</td>`;
            if (h.includes("total") || h.includes("monto") || h.includes("precio")) return `<td>${dinero(totalVenta)}</td>`;
            return `<td>-</td>`;
          }).join("")}</tr>`;
        }

        return `<tr>
          <td>${v.numventa || v.identificacion}</td>
          <td>${v.fecha || "-"}</td>
          <td>${cliente}</td>
          <td>${resumenProductos}</td>
          <td>${dinero(totalVenta)}</td>
        </tr>`;
      }).join("");

      continue;
    }

    // Por defecto, si la tabla es de PRODUCTOS / INVENTARIO / EXISTENCIAS
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
      const est = stock === 0 ? ["no", "No disponible"] : (stock <= 3 ? ["poco", "Por agotarse"] : ["ok", "Disponible"]);
      const badgeEstado = `<span class="estado estado--${est[0]}">${est[1]}</span>`;

      // Si la tabla HTML tiene encabezados <th>, acomoda cada dato en su columna exacta
      if (encabezados.length > 0) {
        return `<tr>${encabezados.map(h => {
          if (h.includes("código") || h.includes("codigo") || h.includes("serie")) return `<td>${p.numserie || p.identificacion}</td>`;
          if (h.includes("id")) return `<td>${p.identificacion}</td>`;
          if (h.includes("nombre") || h.includes("producto") || h.includes("instrumento")) return `<td>${p.nombre || "-"}</td>`;
          if (h.includes("marca")) return `<td>${p.marca || "-"}</td>`;
          if (h.includes("modelo")) return `<td>${p.modelo || "-"}</td>`;
          if (h.includes("tipo") || h.includes("categor")) return `<td>${p.tipo_producto || "-"}</td>`;
          if (h.includes("total")) return `<td>${dinero(p.total_parcial ?? (p.precio * stock))}</td>`;
          if (h.includes("precio") || h.includes("costo")) return `<td>${dinero(p.precio)}</td>`;
          if (h.includes("stock") || h.includes("existencia") || h.includes("cant") || h.includes("disponible")) return `<td>${stock}</td>`;
          if (h.includes("estado") || h.includes("estatus")) return `<td>${badgeEstado}</td>`;
          if (h.includes("acción") || h.includes("accion") || h.includes("opci")) {
            return `<td><button type="button" class="boton boton--contorno" onclick="eliminarProducto(${p.identificacion})">Eliminar</button></td>`;
          }
          return `<td>-</td>`;
        }).join("")}</tr>`;
      }

      // Si no tiene <thead>, pinta las columnas estándar de productos
      return `<tr>
        <td>${p.numserie || p.identificacion}</td>
        <td>${p.nombre || "-"}</td>
        <td>${dinero(p.precio)}</td>
        <td>${stock}</td>
        <td>${badgeEstado}</td>
      </tr>`;
    }).join("");
  }
}

// Función global para eliminar un producto si la tabla tiene columna de "Acciones"
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

// 4. INICIALIZACIÓN GENERAL DE EVENTOS
document.addEventListener("DOMContentLoaded", async function () {
  const conectado = await probarConexion();
  if (conectado) {
    await cargarTablasAutomaticamente();
  }

  // A) REGISTRAR PRODUCTO EN TABLA 'productos' (registrar-producto.html)
  const formRegistrar = document.getElementById("form-registrar-producto");
  if (formRegistrar) {
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
      const precioVal = parseFloat(document.getElementById("precio").value) || 0;
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
        console.error("Error al guardar producto:", error.message);
        mostrarAviso("Error: " + error.message);
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Guardar";
        return;
      }

      mostrarAviso(formRegistrar.getAttribute("data-aviso") || "Producto guardado");
      const destino = formRegistrar.getAttribute("data-destino");
      if (destino) {
        setTimeout(() => { location.href = destino; }, 900);
      }
    });
  }

  // B) RESTO DE FORMULARIOS DEMO CON data-aviso
  document.querySelectorAll("form[data-aviso]:not(#form-registrar-producto)").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      mostrarAviso(f.getAttribute("data-aviso"));
      setTimeout(function () {
        location.href = f.getAttribute("data-destino");
      }, 900);
    });
  });

  // C) CONSULTA DE EXISTENCIA (consulta-existencia.html)
  const formBusqueda = document.getElementById("form-busqueda");
  if (formBusqueda) {
    const caja = document.getElementById("resultado");

    formBusqueda.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!db) {
        caja.innerHTML = '<p class="sin-resultados">Conectando con la base de datos, intenta de nuevo...</p>';
        return;
      }

      const q = document.getElementById("buscar").value.trim();
      caja.innerHTML = '<p>Buscando en inventario...</p>';

      let query = db.from("productos").select("*");
      if (q) {
        query = query.or(`nombre.ilike.%${q}%,numserie.ilike.%${q}%,marca.ilike.%${q}%,modelo.ilike.%${q}%`);
      }

      const { data: productos, error } = await query.limit(1);

      if (error) {
        caja.innerHTML = '<p class="sin-resultados">Error al consultar Supabase: ' + error.message + '</p>';
        return;
      }

      if (!productos || productos.length === 0) {
        caja.innerHTML = '<p class="sin-resultados">No se encontró ningún producto con “' + q + '”.</p>';
        return;
      }

      const p = productos[0];
      const stock = Number(p.continuo ?? 0);
      const est = stock === 0 ? ["no", "No disponible"] : (stock <= 3 ? ["poco", "Por agotarse"] : ["ok", "Disponible"]);

      caja.innerHTML =
        '<dl class="ficha">' +
        '<div class="dato"><dt>Nombre</dt><dd>' + (p.nombre || "Sin nombre") + '</dd></div>' +
        (p.marca ? '<div class="dato"><dt>Marca / Modelo</dt><dd>' + p.marca + ' ' + (p.modelo || '') + '</dd></div>' : '') +
        '<div class="dato"><dt>Precio</dt><dd>' + dinero(p.precio) + '</dd></div>' +
        '<div class="dato"><dt>Núm. Serie</dt><dd>' + (p.numserie || "N/A") + '</dd></div>' +
        '<div class="dato"><dt>Existencia (Continuo)</dt><dd><span class="estado estado--' + est[0] + '">' + est[1] + ' (' + stock + ')</span></dd></div>' +
        '</dl>';
    });
  }
});