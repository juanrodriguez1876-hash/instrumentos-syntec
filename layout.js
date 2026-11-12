/* =====================================================================
   layout.js · Instrumentos Sintek
   1) Tema claro/oscuro (recuerda la elección; si no hay, sigue al sistema).
   2) Arma la barra lateral, la barra superior y las pestañas del celular
      alrededor del contenido de cada página. Así las páginas solo
      necesitan su <main class="contenido"> y no repiten el menú.
   Se carga en el <head>:  <script src="layout.js"></script>
   ===================================================================== */
(function () {
  var raiz = document.documentElement;
  var CLAVE = "sintek-tema";
 
  /* ---------- 1. Tema ---------- */
  function leerTema() { try { return localStorage.getItem(CLAVE); } catch (e) { return null; } }
  function guardarTema(t) { try { localStorage.setItem(CLAVE, t); } catch (e) {} }
  function temaActual() {
    return raiz.getAttribute("data-tema") ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro");
  }
  if (leerTema()) raiz.setAttribute("data-tema", leerTema());   // antes de pintar, sin parpadeo
 
  /* ---------- 2. Datos del menú ---------- */
  // Cuando una pantalla exista, solo cambia su "#" por el nombre del archivo.
  var USUARIO = { nombre: "Ana Torres", rol: "Administradora" };  // después vendrá del login
 
  var ICONOS = {
    inicio: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    venta: '<path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6 5 3H2"/><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>',
    hist: '<path d="M4 5v5h5"/><path d="M4.6 10A8 8 0 1 1 4 12"/><path d="M12 8v4l3 2"/>',
    clientes: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><path d="M16 5.5a3 3 0 0 1 0 5.5M18 14.5c1.9.8 3 2.7 3 5.5"/>',
    prod: '<path d="M12 3 3 7.5v9L12 21l9-4.5v-9z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
    gest: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    exist: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h8"/>',
    cons: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    ctrl: '<path d="M5 4h14v16H5z"/><path d="m9 12 2 2 4-4"/>',
    ajuste: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    entr: '<path d="M5 4h14v16H5z"/><path d="m9 12 2 2 4-4"/>',
    asis: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    cuenta: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    prov: '<path d="M2 6h12v10H2zM14 9h4l4 4v3h-8z"/><circle cx="7" cy="18" r="1.8"/><circle cx="18" cy="18" r="1.8"/>',
    emp: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    nuevo: '<circle cx="10" cy="8" r="3.5"/><path d="M3 20c0-3.6 3-6 7-6M18 14v6M15 17h6"/>',
    rep: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    usr: '<path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6z"/>',
    luna: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    salir: '<path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M19 12H9"/>'
  };
  function icono(n) { return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + ICONOS[n] + '</svg>'; }
 
  var MENU = [
    ["Ventas", [["inicio", "Inicio", "inicio.html"], ["venta", "Registrar venta", "registrar-venta.html"]]],
    ["Inventario", [["ctrl", "Control de inventario", "control-inventario.html"], ["gest", "Gestionar inventario", "gestion-inventario.html"],
                    ["mas", "Registrar producto", "registrar-producto.html"], ["exist", "Existencias", "existencias.html"],
                    ["cons", "Consulta de existencia", "consulta-existencia.html"]]],
    ["Compras", [["prov", "Proveedores", "proveedores.html"]]],
    ["Personal", [["emp", "Empleados", "gestion-empleados.html"]]],
    ["Análisis", [["rep", "Reportes", "generar-reportes.html"]]]
  ];
  // Qué opción del menú se ilumina en cada archivo (los que no aparecen usan su propio nombre)
  var ACTIVA = { "metodo-pago": "venta", "nuevo-empleado": "emp" };
  var PESTANAS = [["inicio", "Inicio", "inicio.html"], ["venta", "Vender", "registrar-venta.html"],
                  ["exist", "Existencias", "existencias.html"], ["prov", "Proveedores", "proveedores.html"]];
 
  // Escudo metálico: cada logo lleva su propio degradado (un id distinto) para que se vea
  // aunque otro logo de la página esté oculto.
  var nLogo = 0;
  function logo() {
    var id = "metal" + (++nLogo);
    return '<svg viewBox="0 0 64 72" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
           '<stop offset="0" stop-color="#f4f7fc"/><stop offset=".3" stop-color="#b8c2d6"/><stop offset=".52" stop-color="#e8edf6"/>' +
           '<stop offset=".78" stop-color="#a3aec4"/><stop offset="1" stop-color="#dfe5f0"/></linearGradient></defs>' +
           '<path d="M32 2C14 2 4 14 4 30c0 16 16 30 28 40 12-10 28-24 28-40C60 14 50 2 32 2Z" fill="url(#' + id + ')"/>' +
           '<text x="32" y="40" text-anchor="middle" font-size="22" font-weight="600" fill="#0f1d44" font-family="Oswald, Arial, sans-serif">IS</text></svg>';
  }
 
  function crear(etiqueta, clase, html) {
    var e = document.createElement(etiqueta);
    if (clase) e.className = clase;
    if (html) e.innerHTML = html;
    return e;
  }
 
  /* Botón de tema (en todas las pantallas) */
  function botonTema() {
    var b = crear("button", "cambiar-tema");
    b.type = "button";
    function pintar() {
      var oscuro = temaActual() === "oscuro";
      b.innerHTML = icono(oscuro ? "sol" : "luna");
      b.setAttribute("aria-label", oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    }
    b.addEventListener("click", function () {
      var nuevo = temaActual() === "oscuro" ? "claro" : "oscuro";
      raiz.setAttribute("data-tema", nuevo);
      guardarTema(nuevo);
      pintar();
    });
    pintar();
    return b;
  }
 
  /* ---------- 3. Pantalla de inicio de sesión ---------- */
  function armarLogin() {
    // Cinco líneas de pentagrama que ondulan y fluyen a distinta velocidad.
    // Cada onda se repite cada 800 unidades, por eso el bucle no se nota.
    var pauta = "";
    [40, 62, 84, 106, 128].forEach(function (y, i) {
      var d = "M0 " + y + " Q200 " + (y - 22) + " 400 " + y;
      for (var k = 0; k < 5; k++) d += " T" + (800 + k * 400) + " " + y;
      pauta += '<g style="--t:' + (26 + i * 5) + 's"><path d="' + d + '"/></g>';
    });
    var notas = "";
    [["♪", 8, 26, 17, 0], ["♫", 22, 34, 22, -6], ["♩", 38, 24, 19, -11], ["♬", 55, 30, 24, -3], ["♪", 70, 22, 16, -9], ["♫", 86, 32, 21, -14]]
      .forEach(function (n) {
        notas += '<span style="--x:' + n[1] + '%;--s:' + n[2] + 'px;--d:' + n[3] + 's;--r:' + n[4] + 's">' + n[0] + '</span>';
      });
    var marca = crear("aside", "login-marca",
      '<div class="notas" aria-hidden="true">' + notas + '</div>' +
      '<div class="marca">' + logo() + '<div><b>Instrumentos Sintek</b><small>Ventas e inventario</small></div></div>' +
      '<svg class="pauta" viewBox="0 0 1600 170" fill="none" stroke="#cfd7e6" stroke-opacity=".45" stroke-width="1.3" preserveAspectRatio="none" aria-hidden="true">' + pauta + '</svg>' +
      '<h2>Tu tienda de música, en orden.</h2>' +
      '<p>Registra ventas, controla las existencias y recibe a tus proveedores sin perder una cuerda.</p>');
    document.body.insertBefore(marca, document.body.firstChild);
    document.body.appendChild(botonTema());
  }
 
  /* ---------- 4. Resto de pantallas ---------- */
  function armarSistema() {
    var cuerpo = document.body;
    var contenido = document.querySelector("main.contenido");
    if (!contenido) return;
 
    var archivo = location.pathname.split("/").pop().replace(".html", "") || "index";
    var activa = ACTIVA[archivo] || archivo;
    // inicio.html es la pantalla de Inicio
    if (archivo === "inicio") activa = "inicio";
 
    // Barra lateral
    var grupos = "";
    MENU.forEach(function (g) {
      var items = "";
      g[1].forEach(function (it) {
        items += '<a class="nav" href="' + it[2] + '"' + (it[0] === activa || it[2].replace(".html", "") === archivo ? ' aria-current="page"' : '') + '>' + icono(it[0]) + it[1] + '</a>';
      });
      grupos += '<div class="grupo"><span>' + g[0] + '</span>' + items + '</div>';
    });
    var lateral = crear("aside", "lateral",
      '<div class="marca">' + logo() + '<div><b>Instrumentos Sintek</b><small>Ventas e inventario</small></div></div>' + grupos +
      '<div class="pie"><a href="index.html">' + icono("salir") + 'Cerrar sesión</a></div>');
    lateral.id = "menu-lateral";
    lateral.setAttribute("aria-label", "Menú del sistema");
 
    // Barra superior: título de la página, acción principal, tema y usuario
    var superior = crear("header", "superior");
    superior.appendChild(crear("span", "marca-movil", logo()));
    var titulo = contenido.querySelector("h1.titulo");
    var sub = contenido.querySelector(".subtitulo");
    if (titulo) {                                       // el mismo h1 (y su subtítulo), movidos a la barra
      var bloque = crear("div", "titulo-bloque");
      bloque.appendChild(titulo);
      if (sub) bloque.appendChild(sub);
      superior.appendChild(bloque);
    }
    var der = crear("div", "der");
    var accion = contenido.querySelector(".barra-accion .enlace-accion");
    if (accion) {
      var texto = accion.querySelector(".icono-mas");
      if (texto) texto.remove();
      accion.innerHTML = '<span class="icono-mas" aria-hidden="true">+</span>' + accion.innerHTML.replace(/<span[^>]*><\/span>/, "");
      accion.setAttribute("aria-label", accion.textContent.replace("+", "").trim());
      der.appendChild(accion);
      var vacio = contenido.querySelector(".barra-accion");
      if (vacio) vacio.remove();
    }
    der.appendChild(botonTema());
    var iniciales = USUARIO.nombre.split(" ").map(function (p) { return p[0]; }).join("").slice(0, 2);
    var yo = crear("a", "yo", '<i aria-hidden="true">' + iniciales + '</i><div><b>' + USUARIO.nombre + '</b><small>' + USUARIO.rol + '</small></div>');
    yo.href = "#";
    yo.setAttribute("aria-label", "Mi cuenta: " + USUARIO.nombre);
    der.appendChild(yo);
    superior.appendChild(der);
 
    // Estructura final
    var principal = crear("div", "principal");
    var aviso = document.querySelector(".aviso");
    principal.appendChild(superior);
    if (aviso) principal.appendChild(aviso);
    principal.appendChild(contenido);
    var app = crear("div", "app");
    app.appendChild(lateral);
    app.appendChild(principal);
 
    // Pestañas del celular (la quinta abre el menú completo)
    var tabs = '';
    PESTANAS.forEach(function (t) {
      tabs += '<a href="' + t[2] + '"' + (t[0] === activa ? ' aria-current="page"' : '') + '>' + icono(t[0]) + t[1] + '</a>';
    });
    tabs += '<button type="button" aria-expanded="false" aria-controls="menu-lateral">' + icono("menu") + 'Menú</button>';
    var pestanas = crear("nav", "pestanas", tabs);
    pestanas.setAttribute("aria-label", "Principal");
 
    var vieja = cuerpo.querySelector(".barra");
    if (vieja) vieja.remove();
    cuerpo.insertBefore(app, cuerpo.firstChild);
    cuerpo.appendChild(pestanas);
 
    var btnMenu = pestanas.querySelector("button");
    function menu(abrir) { cuerpo.classList.toggle("menu-abierto", abrir); btnMenu.setAttribute("aria-expanded", String(abrir)); }
    btnMenu.addEventListener("click", function () { menu(!cuerpo.classList.contains("menu-abierto")); });
    lateral.addEventListener("click", function (e) { if (e.target.closest("a")) menu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") menu(false); });
  }
 
  /* Selector de apariencia de la pantalla Mi cuenta: botones con data-tema-opcion="claro|oscuro|auto" */
  function conectarApariencia() {
    var botones = document.querySelectorAll("[data-tema-opcion]");
    if (!botones.length) return;
    function marcar() {
      var elegido = leerTema() || "auto";
      botones.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-tema-opcion") === elegido)); });
    }
    botones.forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-tema-opcion");
        if (v === "auto") { try { localStorage.removeItem(CLAVE); } catch (e) {} raiz.removeAttribute("data-tema"); }
        else { guardarTema(v); raiz.setAttribute("data-tema", v); }
        marcar();
        var t = document.querySelector(".cambiar-tema");
        if (t) { var o = temaActual() === "oscuro"; t.innerHTML = icono(o ? "sol" : "luna"); }
      });
    });
    marcar();
  }
 
  document.addEventListener("DOMContentLoaded", function () {
    if (document.body.classList.contains("pagina-login")) armarLogin();
    else if (document.body.classList.contains("pagina-tarjeta")) armarLogin();   // crear cuenta: mismo fondo animado que el login
    else { armarSistema(); conectarApariencia(); }
  });
})();
 