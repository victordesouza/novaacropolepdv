export type AppRole = "Administrador" | "Recepção";

export type StoredCurrentUser = {
  id: string;
  username: string;
  role: AppRole;
  loginTime: string;
};

const USER_ROLE_MAP: Record<string, AppRole> = {
  Admin: "Administrador",
  Administrador: "Administrador",
  Operador: "Recepção",
  "Recepção": "Recepção",
};

export function normalizeRole(role?: string | null): AppRole {
  if (!role) return "Recepção";
  return USER_ROLE_MAP[role] ?? "Recepção";
}

export function isAdminRole(role?: string | null) {
  return normalizeRole(role) === "Administrador";
}

export function getInitialRouteForRole(role?: string | null) {
  return isAdminRole(role) ? "/" : "/pos";
}

export function getStoredCurrentUser(): StoredCurrentUser | null {
  if (typeof localStorage === "undefined") return null;

  const userData = localStorage.getItem("na-current-user");
  if (!userData) return null;

  try {
    const parsed = JSON.parse(userData) as Partial<StoredCurrentUser>;
    if (!parsed.username || !parsed.loginTime) return null;

    return {
      id: parsed.id ?? parsed.username,
      username: parsed.username,
      role: normalizeRole(parsed.role),
      loginTime: parsed.loginTime,
    };
  } catch {
    return null;
  }
}
