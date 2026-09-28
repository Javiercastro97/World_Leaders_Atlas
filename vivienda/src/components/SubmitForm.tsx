"use client";
/**
 * Mejora progresiva: el <form> funciona sin JavaScript (POST clásico + redirección).
 * Con JavaScript se envía por fetch y se muestran los errores junto a cada campo.
 */
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

export function SubmitForm({ action, success, children, submitLabel }: { action: string; success: string; children: ReactNode; submitLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setIssues([]);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    fd.forEach((v, k) => {
      if (typeof v === "string") body[k] = v;
    });
    try {
      const res = await fetch(action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push(success);
        return;
      }
      setError(data.error ?? "No se pudo enviar.");
      setIssues(data.issues ?? []);
    } catch {
      setError("Sin conexión. Tu texto sigue aquí: inténtalo de nuevo cuando tengas cobertura.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" action={action} onSubmit={onSubmit} noValidate={false} className="space-y-5">
      {children}
      {error && (
        <div role="alert" className="border-l-4 border-signal bg-signal-wash p-3 text-sm">
          <p className="font-bold">{error}</p>
          {issues.length > 0 && (
            <ul className="list-[square] pl-5 mt-1">
              {issues.map((i) => (
                <li key={i.path + i.message}>
                  <strong>{FIELD_LABEL[i.path] ?? i.path}</strong>: {i.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button type="submit" className="btn btn-primary w-full md:w-auto" disabled={busy}>
        {busy ? "Enviando…" : submitLabel}
      </button>
    </form>
  );
}

const FIELD_LABEL: Record<string, string> = {
  type: "Tipo",
  date: "Fecha",
  time: "Hora",
  municipality: "Municipio",
  province_id: "Provincia",
  organization: "Organización",
  source_url: "URL de la fuente",
  description: "Descripción",
  meeting_point: "Punto de concentración",
  comments: "Comentarios",
  confirm_public: "Confirmación",
  message: "Mensaje",
  reason: "Motivo",
};
