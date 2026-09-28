// Esquema de episode.json. Todos los tiempos están en SEGUNDOS.
// Dentro de una escena, `at`/`t`/`until` son relativos al inicio de la escena.

export type Vec2 = [number, number];

export type Bus = "VOICE" | "AMBIENCE" | "FOLEY" | "COMEDY_SFX" | "MUSIC";

export type CameraMoveName =
  | "POV_LOOK_LEFT"
  | "POV_LOOK_RIGHT"
  | "POV_LOOK_DOWN"
  | "POV_LOOK_UP"
  | "POV_MICRO_SHAKE"
  | "POV_DOUBLE_TAKE"
  | "POV_SLOW_APPROACH"
  | "POV_SNAP_ZOOM"
  | "POV_PANIC"
  | "POV_FREEZE";

export interface CameraMove {
  move: CameraMoveName;
  at?: number; // inicio (s), por defecto 0
  dur?: number; // duración del movimiento (s)
  until?: number; // hasta cuándo dura el efecto (shake/panic/freeze/hold)
  amount?: number; // píxeles para LOOK_*, amplitud para SHAKE/PANIC
  zoom?: number; // zoom destino para SNAP_ZOOM / SLOW_APPROACH
  target?: Vec2; // punto del mundo (px 1080x1920) al que mirar
  steps?: number; // nº de poses intermedias (animación a pocos frames)
  returnAt?: number; // LOOK_*: vuelve a centro en este segundo
  direction?: "left" | "right";
}

/** Keyframe escalonado. Sin interpolación salvo que el elemento pida `ease: "jerk"`. */
export interface Key {
  t: number;
  x?: number;
  y?: number;
  scale?: number;
  sx?: number;
  sy?: number;
  rot?: number;
  opacity?: number;
  pose?: string;
}

export interface Placed {
  id?: string;
  x: number;
  y: number;
  scale?: number;
  rot?: number;
  opacity?: number;
  z?: number;
  at?: number; // aparece de golpe en este segundo
  until?: number; // desaparece de golpe
  keys?: Key[];
  ease?: "step" | "jerk" | "linear";
  jerkSteps?: number; // en "jerk": nº de poses entre keyframes (def. 3)
  flip?: boolean;
}

export interface PropSpec extends Placed {
  asset: string; // nombre del registro de props, o "image:images/foo.png"
  props?: Record<string, unknown>;
}

export interface CharacterSpec extends Placed {
  asset: string;
  pose?: string;
  props?: Record<string, unknown>;
}

export type HandPose = "rest" | "point" | "press" | "grab" | "nervous" | "hide";

export interface HandSpec extends Placed {
  side: "left" | "right";
  pose?: HandPose;
  asset?: string; // "image:images/mano.png" para sustituir la mano dibujada
  tremble?: number; // px de temblor nervioso
}

export type DoodleType =
  | "DOODLE_ARROW"
  | "DOODLE_CIRCLE"
  | "DOODLE_EYES"
  | "DOODLE_TEXT"
  | "DOODLE_SHAKE"
  | "DOODLE_HALO"
  | "DOODLE_DEVIL"
  | "DOODLE_QUESTION"
  | "DOODLE_TARGET"
  | "DOODLE_IMAGE";

export interface DoodleSpec {
  type: DoodleType;
  at?: number;
  until?: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
  rot?: number;
  scale?: number;
  to?: Vec2; // ARROW: punta
  text?: string; // TEXT / etiqueta de ARROW
  color?: string;
  draw?: number; // segundos que tarda en "dibujarse" (a saltos)
  space?: "world" | "screen"; // world = pegado a la escena (sigue a la cámara)
  seed?: number;
  size?: number; // tamaño de letra en TEXT
  src?: string; // DOODLE_IMAGE: png de doodles/
  wiggle?: number; // temblor extra
}

export type WordFx = "grow" | "shake" | "tilt" | "vanish" | "strike" | "arrow" | "tiny";

export interface SubtitleSpec {
  text: string;
  at: number;
  until: number;
  style?: "thought" | "shout" | "whisper";
  words?: Record<string, WordFx | WordFx[]>;
  y?: number; // posición vertical (centro), por defecto la del episodio
  x?: number;
  rot?: number;
  size?: number;
}

export interface SoundSpec {
  sound: string; // nombre de la biblioteca (_shared/sfx) o ruta "audio/x.wav"
  at?: number;
  until?: number; // corta el sonido (silencio seco)
  bus?: Bus;
  volume?: number;
  loop?: boolean;
  trimStart?: number;
  rate?: number;
}

export interface VoiceSpec extends SoundSpec {
  line?: string; // texto de referencia (guion)
}

export interface AnimationSpec {
  target: string; // id de prop / personaje / mano, o "world" / "screen"
  preset: "fall" | "pop_in" | "drop_in" | "slide_in_left" | "slide_in_right" | "shake" | "squash" | "flicker" | "wobble";
  at?: number;
  dur?: number;
  amount?: number;
}

export interface LightKey {
  t: number;
  level: number; // 1 = normal, 0 = negro
}

export interface BackgroundSpec {
  set: string; // registro de fondos
  lighting?: LightKey[];
  alarm?: { at: number; until?: number; color?: string; period?: number };
  props?: Record<string, unknown>;
}

export interface SceneSpec {
  id?: string;
  start: number;
  end: number;
  note?: string; // intención cómica (solo documentación)
  background: BackgroundSpec;
  camera?: CameraMove[];
  voice?: VoiceSpec[];
  subtitle?: SubtitleSpec[];
  characters?: CharacterSpec[];
  props?: PropSpec[];
  hands?: HandSpec[];
  doodles?: DoodleSpec[];
  sfx?: SoundSpec[];
  animations?: AnimationSpec[];
}

export interface Episode {
  id: string;
  title: string;
  character: string;
  duration: number;
  output?: string;
  disclaimer?: string;
  subtitleY?: number;
  mix?: Partial<Record<Bus, number>>;
  scenes: SceneSpec[];
  /** Pistas continuas que cruzan escenas (ambiente, música). Tiempos absolutos. */
  tracks?: SoundSpec[];
}

export interface EpisodeProps extends Record<string, unknown> {
  episode: Episode;
  /** Carpeta del episodio relativa a episodes/ (para resolver assets). */
  dir: string;
}
