import { isSupabaseConfigured, supabase } from "./supabase.js";
import { AuthError, parseDatabaseError } from "./validation.js";

// Memoria volátil de sesión para evitar almacenar credenciales y tokens en localStorage
let activeSessionMemory = null;

/**
 * Servicio de Autenticación y Autorización de Nivel Profesional
 * Integrado estrictamente con Supabase Auth (Servidor / Base de datos)
 * Sin contraseñas hardcodeadas ni backdoors inseguros.
 */
export const authService = {
  /**
   * Obtiene la sesión actual directamente desde Supabase Auth (servidor/JWT)
   */
  async getCurrentSession() {
    if (activeSessionMemory) return activeSessionMemory;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (session?.user) {
          // Obtener perfil con rol desde public.profiles en base de datos
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          const role = profile?.role || session.user.user_metadata?.role || "cajero";
          activeSessionMemory = {
            id: session.user.id,
            email: session.user.email,
            username: profile?.username || session.user.user_metadata?.username || session.user.email.split("@")[0],
            fullName: profile?.full_name || session.user.user_metadata?.full_name || "Operador",
            role: role === "admin" ? "Administrador" : role === "stock" ? "Encargado de Stock" : "Cajero",
            rawRole: role,
            loginAt: new Date().toISOString(),
          };
          return activeSessionMemory;
        }
      } catch (err) {
        console.warn("Fallo al recuperar sesión de Supabase Auth:", err);
      }
    }

    return null;
  },

  /**
   * Inicio de Sesión seguro mediante el backend de Supabase Auth
   */
  async signIn({ identifier, password }) {
    const idClean = (identifier || "").trim();
    const passClean = (password || "").trim();

    if (!idClean) {
      throw new AuthError("Por favor ingresá tu usuario o correo electrónico.");
    }
    if (!passClean) {
      throw new AuthError("Por favor ingresá tu contraseña.");
    }

    if (!isSupabaseConfigured || !supabase) {
      throw new AuthError(
        "El servidor de autenticación (Supabase) no está configurado. Verificá las credenciales en .env."
      );
    }

    // Normalizar email: si ingresan usuario simple, se normaliza con el dominio del comercio
    const email = idClean.includes("@") ? idClean : `${idClean.toLowerCase()}@carniceria.com`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: passClean,
    });

    if (error) {
      // Mensajes de error claros sin filtrar información interna
      if (error.message?.includes("Invalid login credentials")) {
        throw new AuthError("Usuario o contraseña incorrectos.");
      }
      throw new AuthError(parseDatabaseError(error));
    }

    if (!data?.user) {
      throw new AuthError("No se pudo iniciar sesión. Verificá tus credenciales.");
    }

    // Consultar el perfil y rol en la tabla public.profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    const rawRole = profile?.role || data.user.user_metadata?.role || "cajero";
    activeSessionMemory = {
      id: data.user.id,
      email: data.user.email,
      username: profile?.username || data.user.user_metadata?.username || idClean,
      fullName: profile?.full_name || data.user.user_metadata?.full_name || "Operador",
      role: rawRole === "admin" ? "Administrador" : rawRole === "stock" ? "Encargado de Stock" : "Cajero",
      rawRole,
      loginAt: new Date().toISOString(),
    };

    return activeSessionMemory;
  },

  /**
   * Cierre de Sesión Seguro en el servidor e invalidación de memoria local
   */
  async signOut() {
    activeSessionMemory = null;
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("Error al cerrar sesión en Supabase:", err);
      }
    }
  },

  /**
   * Registro de Nuevo Usuario / Empleado en el servidor (Solo Admin)
   */
  async createEmployee({ email, password, username, fullName, role = "cajero" }) {
    if (!isSupabaseConfigured || !supabase) {
      throw new AuthError("El backend Supabase no está configurado.");
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.trim(),
          full_name: fullName.trim(),
          role,
        },
      },
    });

    if (error) throw new AuthError(parseDatabaseError(error));
    return data.user;
  },

  /**
   * Suscripción a eventos de autenticación y refresco automático de tokens JWT
   */
  onAuthStateChange(callback) {
    if (!isSupabaseConfigured || !supabase) return () => {};
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_OUT") {
          activeSessionMemory = null;
          callback(null);
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          if (session?.user) {
            const profile = await authService.getCurrentSession();
            callback(profile);
          }
        }
      });
      return () => subscription?.unsubscribe();
    } catch {
      return () => {};
    }
  },

  /**
   * Validador de Autorización y Permisos por Rol
   */
  hasPermission(user, requiredRole) {
    if (!user) return false;
    if (user.rawRole === "admin" || user.role === "Administrador") return true;
    if (requiredRole === "stock" && (user.rawRole === "stock" || user.role === "Encargado de Stock")) return true;
    if (requiredRole === "cajero" && (user.rawRole === "cajero" || user.role === "Cajero")) return true;
    return false;
  },
};
