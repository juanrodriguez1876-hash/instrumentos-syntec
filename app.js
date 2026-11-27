/* =====================================================
   INSTRUMENTOS SINTEK
   Aplicación conectada a Supabase
   ===================================================== */

// 1. CONFIGURACIÓN DE SUPABASE

const SUPABASE_URL = "https://phgozpmwgtbdiwzbbvcm.supabase.co";
const SUPABASE_KEY = "sb_publishable_xGK8x1qxR8s_LjP3tcy6zA_62wPGS4o";

let db = null;


// 2. INICIALIZAR SUPABASE


function inicializarBusqueda() {

  const { formulario, cajaResultado } = asegurarControlesExistencias();

  if (!formulario || !cajaResultado) return;

  // Evitar duplicar los controles
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

  // Obtener controles
  const inputNombre =
    document.getElementById("buscar-nombre");

  const inputMinimo =
    document.getElementById("precio-minimo");

  const inputMaximo =
    document.getElementById("precio-maximo");

  const btnLimpiar =
    document.getElementById("btn-limpiar-existencias");

  let busquedaEjecutada = false;

  // Consultar productos y aplicar filtros
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

    const minimo = minimoTexto === ""
      ? null
      : Number(minimoTexto);

    const maximo = maximoTexto === ""
      ? null
      : Number(maximoTexto);

    if (
      (minimo !== null &&
        (!Number.isFinite(minimo) || minimo < 0)) ||
      (maximo !== null &&
        (!Number.isFinite(maximo) || maximo < 0))
    ) {
      cajaResultado.innerHTML = `
        <p class="sin-resultados">
          Introduce precios válidos.
        </p>
      `;
      return;
    }

    if (
      minimo !== null &&
      maximo !== null &&
      minimo > maximo
    ) {
      cajaResultado.innerHTML = `
        <p class="sin-resultados">
          El precio mínimo no puede ser mayor
          que el precio máximo.
        </p>
      `;
      return;
    }

    cajaResultado.innerHTML = `
      <p>Consultando existencias actuales...</p>
    `;

    try {

      // Consultar directamente la base de datos
      let consulta = db
        .from("productos")
        .select("*");

      if (nombre) {
        const termino = nombre.replace(/[,%()]/g, "");
        consulta = consulta.ilike(
          "nombre",
          `%${termino}%`
        );
      }

      if (minimo !== null) {
        consulta = consulta.gte("precio", minimo);
      }

      if (maximo !== null) {
        consulta = consulta.lte("precio", maximo);
      }

      const { data: productos, error } = await consulta
        .order("nombre", { ascending: true });

      if (error) throw error;

      if (!productos || productos.length === 0) {

        cajaResultado.innerHTML = `
          <p class="sin-resultados">
            No se encontraron productos con los
            filtros seleccionados.
          </p>
        `;

        return;
      }

      // Contabilizar existencias
      const totalProductos = productos.length;

      const agotados = productos.filter(
        p => Number(p.continuo ?? 0) <= 0
      ).length;

      const disponibles = totalProductos - agotados;

      cajaResultado.innerHTML = `

        <div class="resumen-busqueda">

          <p>
            Productos encontrados:
            <strong>${totalProductos}</strong>
          </p>

          <p>
            Productos disponibles:
            <strong>${disponibles}</strong>
          </p>

          <p>
            Productos agotados:
            <strong>${agotados}</strong>
          </p>

        </div>

        <div class="resultados-rango">

          ${productos.map(producto => `

            <div class="ficha">

              <div class="dato">
                <dt>Producto</dt>
                <dd>
                  ${escaparHTML(producto.nombre || "Sin nombre")}
                </dd>
              </div>

              <div class="dato">
                <dt>Marca / Modelo</dt>
                <dd>
                  ${escaparHTML(producto.marca || "-")}
                  ${escaparHTML(producto.modelo || "")}
                </dd>
              </div>

              <div class="dato">
                <dt>Precio</dt>
                <dd>${dinero(producto.precio)}</dd>
              </div>

              <div class="dato">
                <dt>Número de serie</dt>
                <dd>
                  ${escaparHTML(producto.numserie || "N/A")}
                </dd>
              </div>

              <div class="dato">
                <dt>Cantidad disponible</dt>
                <dd>
                  <strong>
                    ${Number(producto.continuo ?? 0)}
                  </strong>
                </dd>
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

      console.error(
        "Error consultando existencias:",
        error
      );

      cajaResultado.innerHTML = `
        <p class="sin-resultados">
          Error al consultar:
          ${escaparHTML(error.message)}
        </p>
      `;
    }
  }

  // Buscar
  formulario.addEventListener("submit", async function(e) {

    e.preventDefault();

    busquedaEjecutada = true;

    await ejecutarBusqueda();

  });

  // Limpiar filtros
  if (btnLimpiar) {

    btnLimpiar.addEventListener("click", async function() {

      if (inputNombre) inputNombre.value = "";

      if (inputMinimo) inputMinimo.value = "";

      if (inputMaximo) inputMaximo.value = "";

      busquedaEjecutada = false;

      cajaResultado.innerHTML = "";

      await cargarTablasAutomaticamente();

    });

  }

  // Actualización automática mediante Supabase Realtime
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
        async function() {

          console.log(
            "Cambio detectado en inventario"
          );

          await cargarTablasAutomaticamente();

          if (busquedaEjecutada) {
            await ejecutarBusqueda();
          }

        }
      )
      .subscribe();

  }

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