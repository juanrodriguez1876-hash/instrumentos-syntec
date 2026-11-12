/* app.js · pequeñas interacciones de demostración (sin servidor) */
document.addEventListener("DOMContentLoaded", function () {
  // Formularios con data-aviso: muestran un mensaje y navegan al destino
  document.querySelectorAll("form[data-aviso]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var a = document.createElement("div");
      a.className = "aviso-flotante"; a.setAttribute("role", "status");
      a.textContent = f.getAttribute("data-aviso");
      document.body.appendChild(a);
      setTimeout(function () { location.href = f.getAttribute("data-destino"); }, 900);
    });
  });

  // Consulta de existencia: busca por nombre o código
  var form = document.getElementById("form-busqueda");
  if (form) {
    var PRODUCTOS = [
      ["STRATOCASTER", "223227185", 1500, 12, 3], ["Guitarra acústica", "23564", 3500, 20, 8],
      ["Violín", "23678", 5700, 2, 3], ["Ukelele", "23654", 2500, 0, 3], ["Saxofón", "73456", 8500, 4, 5],
      ["Guitarra eléctrica", "73145", 8700, 15, 5], ["Piano", "73903", 60000, 1, 1], ["Teclado", "73415", 15000, 9, 2]
    ];
    var caja = document.getElementById("resultado");
    function dinero(n) { return "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2 }); }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = document.getElementById("buscar").value.trim().toLowerCase();
      var p = PRODUCTOS.filter(function (x) { return !q || x[0].toLowerCase().indexOf(q) > -1 || x[1].indexOf(q) > -1; })[0];
      if (!p) { caja.innerHTML = '<p class="sin-resultados">No se encontró ningún producto con “' + q + '”.</p>'; return; }
      var s = p[3], m = p[4];
      var est = s === 0 ? ["no", "No disponible"] : (s <= m ? ["poco", "Por agotarse"] : ["ok", "Disponible"]);
      caja.innerHTML = '<dl class="ficha"><div class="dato"><dt>Nombre</dt><dd>' + p[0] + '</dd></div><div class="dato"><dt>Precio</dt><dd>' + dinero(p[2]) +
        '</dd></div><div class="dato"><dt>Código</dt><dd>' + p[1] + '</dd></div><div class="dato"><dt>Stock disponible</dt><dd><span class="estado estado--' + est[0] + '">' + est[1] + '</span></dd></div></dl>';
    });
  }
});
