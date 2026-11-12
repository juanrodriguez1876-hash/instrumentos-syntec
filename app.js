/* app.js · Conexión real con Supabase + interacciones */

// 1. CONFIGURACIÓN Y LLAVES DE SUPABASE
const SUPABASE_URL = "https://phgozpmwgtbdiwzbbvcm.supabase.co";
const SUPABASE_KEY = "PEGA_AQUI_TU_LLAVE_ANON_PUBLIC_QUE_EMPIEZA_CON_eyJ";
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

// Función auxiliar para mostrar el aviso flotante de tu diseño
function mostrarAviso(texto) {
  const a = document.createElement("div");
  a.className = "aviso-flotante";
  a.setAttribute("role", "status");
  a.textContent = texto;
  document.body.appendChild(a);
  setTimeout(() => a.remove(), 2500);
}

// 2. COMPROBAR CONEXIÓN
async function probarConexion() {
  try {
    await inicializarSupabase();
    const { data, error } = await db
      .from("productos")
      .select("*")
      .limit(5);

    if (error) {
      console.error("Error de conexión con Supabase:", error.message);
      return;
    }

    console.log("Conexión exitosa con Supabase ✅");
    console.log("Productos en BD:", data);
  } catch (err) {
    console.error("Error inicializando Supabase:", err);
  }
}

// 3. LÓGICA DE INTERFAZ Y CONSULTAS
document.addEventListener("DOMContentLoaded", async function () {
  await probarConexion();

  // A) REGISTRAR PRODUCTO EN SUPABASE (registrar-producto.html)
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

      const nuevoProducto = {
        codigo: document.getElementById("codigo").value.trim(),
        nombre: document.getElementById("nombre").value.trim(),
        precio: parseFloat(document.getElementById("precio").value),
        stock: parseInt(document.getElementById("cant").value, 10)
      };

      const { error } = await db
        .from("productos")
        .insert([nuevoProducto]);

      if (error) {
        console.error("Error al guardar producto:", error.message);
        mostrarAviso("Error: " + (error.code === "23505" ? "Ese código ya existe" : error.message));
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

  // B) RESTO DE FORMULARIOS DEMO CON data-aviso (que aún no tienen conexión específica)
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

    function dinero(n) {
      return "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2 });
    }

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
        query = query.or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%`);
      }

      const { data: productos, error } = await query.limit(1);

      if (error) {
        console.error("Error en consulta:", error.message);
        caja.innerHTML = '<p class="sin-resultados">Error al consultar Supabase: ' + error.message + '</p>';
        return;
      }

      if (!productos || productos.length === 0) {
        caja.innerHTML = '<p class="sin-resultados">No se encontró ningún producto con “' + q + '”.</p>';
        return;
      }

      const p = productos[0];
      const s = Number(p.stock ?? 0);
      const m = Number(p.stock_minimo ?? 3);
      const est = s === 0 ? ["no", "No disponible"] : (s <= m ? ["poco", "Por agotarse"] : ["ok", "Disponible"]);

      caja.innerHTML =
        '<dl class="ficha">' +
        '<div class="dato"><dt>Nombre</dt><dd>' + p.nombre + '</dd></div>' +
        '<div class="dato"><dt>Precio</dt><dd>' + dinero(p.precio) + '</dd></div>' +
        '<div class="dato"><dt>Código</dt><dd>' + p.codigo + '</dd></div>' +
        '<div class="dato"><dt>Stock disponible</dt><dd><span class="estado estado--' + est[0] + '">' + est[1] + ' (' + s + ')</span></dd></div>' +
        '</dl>';
    });
  }
});