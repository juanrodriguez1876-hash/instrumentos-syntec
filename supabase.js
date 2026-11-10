
// CONEXION CON SUPABASE

const SUPABASE_URL = "https://phgozpmwgtbdiwzbbvcm.supabase.co";
const SUPABASE_KEY = "sb_publishable_xGK8x1qxR8s_LjP3tcy6zA_62wPGS4oY";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// Comprobar conexion
async function probarConexion() {
    const { data, error } = await db
        .from("productos")
        .select("*")
        .limit(5);

    if (error) {
        console.error("Error de conexion:", error.message);
        return;
    }

    console.log("Conexion exitosa con Supabase");
    console.log("Productos:", data);

probarConexion();
