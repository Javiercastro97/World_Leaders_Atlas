import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Metodología",
  description: "Qué es un lanzamiento, qué es una convocatoria, de dónde vienen los datos, cómo verificamos y cuáles son las limitaciones.",
  alternates: { canonical: "/metodologia" },
};

export default function Metodologia() {
  return (
    <div className="mx-auto max-w-[900px] px-4 md:px-6 py-6 md:py-10">
      <p className="kicker text-signal">Transparencia</p>
      <h1 className="headline text-4xl md:text-5xl mt-1">Metodología</h1>
      <div className="prose-editorial mt-6">
        <p>
          Esta herramienta combina tres tipos de información que <strong>nunca se mezclan</strong>: estadística oficial agregada,
          información publicada por organizaciones y avisos ciudadanos pendientes de verificar. Cada dato visible indica a cuál
          pertenece y de dónde procede.
        </p>

        <h2 id="lanzamientos">Qué es un lanzamiento (y qué no)</h2>
        <p>
          En la estadística judicial, un <strong>lanzamiento</strong> es la diligencia por la que la comisión judicial desaloja a
          los ocupantes de un inmueble en ejecución de una resolución. Es lo que popularmente se llama «desahucio». El Consejo
          General del Poder Judicial (CGPJ) publica cada trimestre cuántos lanzamientos se han <em>practicado</em>, desglosados por
          territorio y por el procedimiento que los origina:
        </p>
        <ul>
          <li>
            <strong>Arrendamientos urbanos (LAU)</strong>: principalmente impago de alquiler o fin de contrato.
          </li>
          <li>
            <strong>Ejecución hipotecaria</strong>: impago de un préstamo hipotecario.
          </li>
          <li>
            <strong>Otros</strong>: el resto de procedimientos (por ejemplo, precario u ocupación).
          </li>
        </ul>
        <p>Límites que conviene tener presentes:</p>
        <ul>
          <li>Un lanzamiento es un acto judicial, no una persona ni un hogar. Un mismo hogar puede acumular varios señalamientos.</li>
          <li>Cuenta lanzamientos <em>practicados</em>: no incluye desalojos que se evitan antes, ni salidas «voluntarias» por presión.</li>
          <li>
            Los datos son <strong>agregados por territorio</strong>. Por eso en el mapa aparecen como colores por provincia o comunidad
            (choropleth), <strong>nunca como puntos</strong>: una provincia con 800 lanzamientos no genera 800 marcadores.
          </li>
          <li>
            El CGPJ agrega por Tribunal Superior de Justicia (TSJ). Ceuta y Melilla pertenecen al TSJ de Andalucía, Ceuta y Melilla: cuando
            solo hay datos por TSJ lo indicamos.
          </li>
          <li>Agosto es inhábil a efectos judiciales: el tercer trimestre suele ser más bajo. Compara con el mismo trimestre del año anterior.</li>
        </ul>

        <h2 id="derivados">Totales calculados</h2>
        <p>
          Cuando la fuente publica provincias pero no el total de la comunidad (o trimestres pero no el año), calculamos la suma{" "}
          <strong>solo si están todas las piezas</strong>. Si falta una provincia o un trimestre, no mostramos total. Estos valores
          se marcan como «calculados» y, si la fuente también publica el total, comprobamos que coinciden y registramos cualquier
          discrepancia en el informe de ingestión.
        </p>
        <p>
          Las tasas por 100.000 habitantes usan la población a 1 de enero del mismo año (INE, Padrón). Sin población de ese año, no
          calculamos tasa.
        </p>

        <h2 id="convocatorias">Qué consideramos convocatoria</h2>
        <p>
          Un evento público y concreto (fecha, lugar, organización) <strong>difundido expresamente por una organización</strong>{" "}
          como convocatoria abierta: una parada de desahucio anunciada, una concentración, una manifestación, una asamblea, una
          asesoría colectiva, una charla o una acción. No publicamos rumores, ni casos individuales que la organización no haya
          hecho públicos, ni convocatorias difundidas solo en grupos privados.
        </p>
        <p>
          Las paradas de desahucio solo muestran un punto exacto cuando la propia organización ha difundido ese lugar como punto
          público de concentración, y solo mientras la convocatoria está activa.
        </p>

        <h2 id="verificacion">Cómo verificamos</h2>
        <p>Cada convocatoria publicada muestra uno de estos estados:</p>
        <ul>
          <li>
            <strong>■ Verificada</strong>: contrastada por moderación con la organización convocante o con dos fuentes independientes.
          </li>
          <li>
            <strong>▣ Fuente oficial del colectivo</strong>: tomada de un canal público y oficial de la propia organización.
          </li>
          <li>
            <strong>□ Pendiente de verificación</strong>: aviso revisado y con fuente enlazada, pero aún no contrastado. Su ubicación
            nunca es más precisa que el barrio.
          </li>
        </ul>
        <p>
          Además, cada convocatoria tiene un estado propio: programada, <strong>cancelada</strong>, <strong>suspendida</strong> o{" "}
          <strong>realizada</strong>. Los avisos ciudadanos siguen siempre el flujo recibido → en revisión → verificado → publicado,
          y cada paso queda en un registro de moderación que no se puede editar.
        </p>
        <p>
          Guardamos para cada evento: URL y nombre de la fuente, tipo de fuente, fecha de recepción, de verificación, de última
          comprobación y de última actualización. Todo es visible en su ficha.
        </p>

        <h2 id="fuentes">De dónde vienen los datos</h2>
        <p>
          Estadística: base de datos PxWeb de la Estadística Judicial del CGPJ y, como denominador, el Padrón del INE. Cuando un dato
          oficial solo existe en un informe, se transcribe a mano en un fichero revisado por pares y se enlaza el informe. Todo el
          material descargado se guarda como <em>snapshot</em> con su huella SHA-256 para que cualquiera pueda reproducir las cifras.
          Detalle completo en <Link href="/fuentes">Fuentes</Link>.
        </p>

        <h2 id="frecuencia">Frecuencia de actualización</h2>
        <ul>
          <li>Estadística judicial: se consulta semanalmente; el CGPJ publica con periodicidad trimestral.</li>
          <li>Población: anual.</li>
          <li>Convocatorias: en cuanto moderación publica un aviso; se revisan de nuevo antes de la fecha cuando es posible.</li>
          <li>Precisión geográfica del histórico: se reduce automáticamente cada día tras la fecha de cada convocatoria.</li>
        </ul>

        <h2 id="correcciones">Política de correcciones</h2>
        <p>
          Cualquier persona puede pedir una corrección o retirada desde <Link href="/reportar">Reportar información</Link> o en
          cada ficha. Las solicitudes relacionadas con datos personales o seguridad se resuelven <strong>primero retirando</strong> y
          después revisando. Las correcciones de datos estadísticos se publican en el historial del repositorio con el motivo.
        </p>

        <h2 id="limitaciones">Limitaciones conocidas</h2>
        <ul>
          <li>La agenda no es exhaustiva: depende de lo que las organizaciones publican y de los avisos recibidos.</li>
          <li>Las tablas PxWeb del CGPJ están organizadas por tipo de órgano judicial; una sola tabla no equivale al total territorial.</li>
          <li>El mapa no representa desahucios futuros ni previstos. La estadística siempre se refiere a periodos pasados.</li>
        </ul>
      </div>
    </div>
  );
}
