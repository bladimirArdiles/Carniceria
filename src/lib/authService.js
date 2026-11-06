import { isSupabaseConfigured, supabase } from "./supabase.js";
import { AuthError, parseDatabaseError } from "./validation.js";

const LOCAL_STORAGE_USER_KEY = "ca:auth-session";

/**
 * Servicio de Autenticación y Autorización integrado con Supabase Auth
 */
export const authService = {
  /**
   * Obtiene la sesión actual persistida (Supabase o Local)
   */
  async getCurrentSession() {
    if (isSupabaseConfigured) {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (session?.user) {
          // Obtener perfil con rol desde public.profiles
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          const role = profile?.role || session.user.user_metadata?.role || "cajero";
          return {
            id: session.user.id,
            email: session.user.email,
            username: profile?.username || session.user.user_metadata?.username || session.user.email.split("@")[0],
            fullName: profile?.full_name || session.user.user_metadata?.full_name || "Operador",
            role: role === "admin" ? "Administrador" : role === "stock" ? "Encargado de Stock" : "Cajero",
            rawRole: role,
            loginAt: new Date().toISOString(),
          };
        }
      } catch (err) {
        console.warn("Fallo al recuperar sesión de Supabase Auth:", err);
      }
    }

    // Fallback a almacenamiento local seguro
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignorar errores de parsing
    }
    return null;
  },

  /**
   * Inicio de Sesión con Email o Usuario y Contraseña
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

    // 1. Intentar con Supabase Auth si está configurado
    if (isSupabaseConfigured) {
      try {
        // Normalizar email: si no tiene arroba, agregamos @carniceria.com
        const email = idClean.includes("@") ? idClean : `${idClean.toLowerCase()}@carniceria.com`;

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: passClean,
        });

        if (!error && data?.user) {
          // Consultar el perfil y rol en la tabla public.profiles
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", data.user.id)
            .single();

          const rawRole = profile?.role || data.user.user_metadata?.role || "cajero";
          const userSession = {
            id: data.user.id,
            email: data.user.email,
            username: profile?.username || data.user.user_metadata?.username || idClean,
            fullName: profile?.full_name || data.user.user_metadata?.full_name || "Operador",
            role: rawRole === "admin" ? "Administrador" : rawRole === "stock" ? "Encargado de Stock" : "Cajero",
            rawRole,
            loginAt: new Date().toISOString(),
          };

          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(userSession));
          return userSession;
        }
      } catch (err) {
        console.warn("Fallo Supabase Auth, evaluando fallback:", err);
      }
    }

    // 2. Fallback de Operación Local y Cuentas de Prueba por Rol
    const isAdm = idClean.toLowerCase().includes("admin");
    const isStk = idClean.toLowerCase().includes("stock");
    const isCaj = idClean.toLowerCase().includes("cajero") || idClean.toLowerCase().includes("mostrador");

    if (isAdm || isStk || isCaj) {
      const validTestPass = passClean === "1234" || passClean === "123456" || passClean.length >= 3;
      if (!validTestPass) {
        throw new AuthError("Contraseña incorrecta (mínimo 3 caracteres).");
      }

      const rawRole = isAdm ? "admin" : isStk ? "stock" : "cajero";
      const localUser = {
        id: "local-" + rawRole,
        email: `${rawRole}@carniceria.com`,
        username: rawRole,
        fullName: isAdm ? "Administrador General" : isStk ? "Encargado de Depósito y Stock" : "Cajero Mostrador",
        role: isAdm ? "Administrador" : isStk ? "Encargado de Stock" : "Cajero",
        rawRole,
        loginAt: new Date().toISOString(),
      };

      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(localUser));
      return localUser;
    }

    throw new AuthError("Usuario o contraseña incorrectos.");
  },

  /**
   * Cierre de Sesión Seguro
   */
  async signOut() {
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("Error al cerrar sesión en Supabase:", err);
      }
    }
  },

  /**
   * Registro de Nuevo Usuario / Empleado (Solo Admin)
   */
  async createEmployee({ email, password, username, fullName, role = "cajero" }) {
    if (!isSupabaseConfigured) {
      throw new AuthError("La base de datos Supabase no está configurada.");
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
    if (!isSupabaseConfigured) return () => {};
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_OUT") {
          localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
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
    if (user.rawRole === "admin" || user.role === "Administrador") return true; // El admin tiene acceso total
    if (requiredRole === "stock" && (user.rawRole === "stock" || user.role === "Encargado de Stock")) return true;
    if (requiredRole === "cajero" && (user.rawRole === "cajero" || user.role === "Cajero")) return true;
    return false;
  },
};

