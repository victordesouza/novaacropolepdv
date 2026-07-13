import type { AppRole } from "@/lib/auth";

export type AuditArea = "Dashboard" | "Produtos" | "PDV" | "Relatórios" | "Usuários";
export type AuditAction = "access" | "create" | "update" | "delete" | "complete";

export function getAreaFromPath(pathname: string): AuditArea {
  if (pathname.startsWith("/products")) return "Produtos";
  if (pathname.startsWith("/pos")) return "PDV";
  if (pathname.startsWith("/reports")) return "Relatórios";
  if (pathname.startsWith("/users")) return "Usuários";
  return "Dashboard";
}

export function buildAuditPayload(data: unknown) {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return String(data);
  }
}

export type AuditAuthor = {
  actorUserId: string;
  actorUsername: string;
  actorRole: AppRole;
  subjectUserId?: string;
  subjectUsername?: string;
};
