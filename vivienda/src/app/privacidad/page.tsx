import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacidad",
  description: "Qué datos tratamos y cuáles no. Diseño de privacidad por defecto conforme al RGPD.",
  alternates: { canonical: "/privacidad" },
};

export default function Privacidad() {
  return (
    <div className="mx-auto max-w-[900px] px-4 md:px-6 py-6 md:py-10">
      <p className="kicker text-signal">Transparencia</p>
      <h1 className="headline text-4xl md:text-5xl mt-1">Privacidad</h1>
      <div className="prose-editorial mt-6">
        <p>
          Esta es una herramienta de solidaridad, no una base de datos de personas vulnerables. Está diseñada para funcionar con{" "}
          <strong>eventos públicos, organizaciones y estadística agregada</strong>, y nada más.
        </p>

        <h2>Lo que no guardamos</h2>
        <ul>
          <li>Nombres, teléfonos, documentos, circunstancias familiares o económicas de personas afectadas.</li>
          <li>Documentos judiciales.</li>
          <li>Tu dirección IP. Para frenar abusos usamos un código derivado (HMAC) que cambia cada día y no permite reconstruirla.</li>
          <li>Tu ubicación. «Cerca de ti» solo la pide si pulsas el botón, la redondea a ~1 km en tu navegador y no la guarda.</li>
          <li>Cookies de seguimiento ni analítica de terceros. La única cookie es la de sesión del equipo de moderación.</li>
        </ul>

        <h2>Lo que tratamos</h2>
        <ul>
          <li>
            <strong>Avisos de convocatorias</strong> que envías: el contenido del formulario. Antes de guardarlo retiramos
            automáticamente teléfonos, DNI/NIE, IBAN y correos del texto libre, y marcamos posibles domicilios para revisión.
          </li>
          <li>
            <strong>Reportes</strong>: el mensaje y, si quieres respuesta, un contacto que se borra al cerrar el reporte.
          </li>
          <li>
            <strong>Registro de moderación</strong>: qué se hizo, cuándo y por qué, para rendir cuentas. No contiene los datos
            retirados.
          </li>
        </ul>

        <h2>Ubicaciones</h2>
        <p>
          Solo mostramos un punto exacto cuando es el <strong>punto público de concentración</strong> difundido por la organización
          convocante y la convocatoria sigue activa. Las convocatorias pendientes de verificar se muestran a nivel de barrio. Al
          terminar, la ubicación se reduce automáticamente a barrio o municipio, también en la base de datos.
        </p>

        <h2>Base legal y derechos (RGPD)</h2>
        <p>
          Los datos de organizaciones y convocatorias son información que ellas mismas hacen pública, tratada por interés legítimo
          de informar. Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición y limitación desde{" "}
          <Link href="/reportar">Reportar información</Link>. Las solicitudes de supresión se atienden retirando primero.
        </p>
        <p>
          Aplicación instalable (PWA): guarda en tu dispositivo una copia de la agenda y del directorio para consultarlos sin
          conexión. No guarda formularios ni información personal. No pedimos permiso de notificaciones.
        </p>
      </div>
    </div>
  );
}
