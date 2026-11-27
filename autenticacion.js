// ============================================================
// AUTENTICACIÓN Y RECUPERACIÓN DE CONTRASEÑA
// Instrumentos Syntek
// ============================================================

const SUPABASE_URL = "https://phgozpmwgtbdiwzbbvcm.supabase.co";
const SUPABASE_KEY = "sb_publishable_xGK8x1qxR8s_LjP3tcy6zA_62wPGS4o";

const authDB = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// ------------------------------------------------------------
// ELEMENTOS Y MENSAJES
// ------------------------------------------------------------

function mostrarMensajeAuth(texto, tipo = "info") {
  const mensaje = document.getElementById("mensaje-auth");

  if (!mensaje) return;

  mensaje.textContent = texto;
  mensaje.className = `mensaje-auth mensaje-${tipo}`;
  mensaje.hidden = false;
}

// ------------------------------------------------------------
// 1. ENVIAR CORREO DE RECUPERACIÓN
// ------------------------------------------------------------

const formularioRecuperar = document.getElementById(
  "form-recuperar"
);

if (formularioRecuperar) {
  formularioRecuperar.addEventListener("submit", async (event) => {
    event.preventDefault();

    const correoInput = document.getElementById("correo");
    const boton = formularioRecuperar.querySelector(
      'button[type="submit"]'
    );

    const correo = correoInput.value.trim();

    // Validar que se haya escrito un correo.
    if (!correo || !correoInput.checkValidity()) {
      mostrarMensajeAuth(
        "Escribe un correo electrónico válido.",
        "error"
      );
      correoInput.focus();
      return;
    }

    boton.disabled = true;
    boton.textContent = "Enviando...";

    try {
      const urlRestablecimiento = new URL(
        "restablecer-contrasena.html",
        window.location.href
      ).href;

      const { error } = await authDB.auth.resetPasswordForEmail(
        correo,
        {
          redirectTo: urlRestablecimiento
        }
      );

      if (error) {
        throw error;
      }

      // Mensaje general para no revelar si el correo está registrado.
      mostrarMensajeAuth(
        "Si existe una cuenta asociada a ese correo, recibirás un enlace para restablecer tu contraseña. Revisa también tu carpeta de spam.",
        "success"
      );

      formularioRecuperar.reset();

    } catch (error) {
      console.error("Error al solicitar recuperación:", error);

      mostrarMensajeAuth(
        "No se pudo enviar el correo de recuperación. Inténtalo nuevamente. " +
        (error.message || ""),
        "error"
      );

    } finally {
      boton.disabled = false;
      boton.textContent = "Enviar enlace";
    }
  });
}

// ------------------------------------------------------------
// 2. DETECTAR EL ENLACE DE RECUPERACIÓN
// ------------------------------------------------------------

const formularioRestablecer = document.getElementById(
  "form-restablecer"
);

if (formularioRestablecer) {
  const contenedorFormulario = document.getElementById(
    "contenedor-restablecer"
  );

  const boton = formularioRestablecer.querySelector(
    'button[type="submit"]'
  );

  let enlaceValido = false;

  // Mostrar errores que Supabase devuelve en la URL.
  const parametrosURL = new URLSearchParams(
    window.location.hash.substring(1)
  );

  const errorURL = parametrosURL.get("error_description");

  if (errorURL) {
    mostrarMensajeAuth(
      "El enlace no es válido o ha expirado. Solicita uno nuevo.",
      "error"
    );
  }

  // Supabase emite PASSWORD_RECOVERY al validar el enlace.
  authDB.auth.onAuthStateChange((evento, session) => {
    if (evento === "PASSWORD_RECOVERY" && session) {
      enlaceValido = true;

      contenedorFormulario.hidden = false;

      mostrarMensajeAuth(
        "Enlace verificado. Ahora puedes establecer tu nueva contraseña.",
        "success"
      );
    }
  });

  // ----------------------------------------------------------
  // 3. GUARDAR LA NUEVA CONTRASEÑA
  // ----------------------------------------------------------

  formularioRestablecer.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      if (!enlaceValido) {
        mostrarMensajeAuth(
          "El enlace de recuperación no es válido o ha expirado. Solicita uno nuevo.",
          "error"
        );
        return;
      }

      const nueva = document.getElementById(
        "nueva-contrasena"
      ).value;

      const confirmar = document.getElementById(
        "confirmar-contrasena"
      ).value;

      // Validar longitud mínima.
      if (nueva.length < 8) {
        mostrarMensajeAuth(
          "La contraseña debe tener al menos 8 caracteres.",
          "error"
        );
        return;
      }

      // Validar coincidencia.
      if (nueva !== confirmar) {
        mostrarMensajeAuth(
          "Las contraseñas no coinciden.",
          "error"
        );
        return;
      }

      boton.disabled = true;
      boton.textContent = "Actualizando...";

      try {
        const { error } = await authDB.auth.updateUser({
          password: nueva
        });

        if (error) {
          throw error;
        }

        enlaceValido = false;
        formularioRestablecer.reset();

        formularioRestablecer.hidden = true;

        mostrarMensajeAuth(
          "¡Tu contraseña se actualizó correctamente! Ya puedes iniciar sesión con tu nueva contraseña.",
          "success"
        );

      } catch (error) {
        console.error("Error al actualizar contraseña:", error);

        mostrarMensajeAuth(
          "No se pudo actualizar la contraseña. " +
          (error.message || "Solicita un nuevo enlace e inténtalo otra vez."),
          "error"
        );

      } finally {
        boton.disabled = false;
        boton.textContent = "Guardar nueva contraseña";
      }
    }
  );
}