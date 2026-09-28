import { Config } from "@remotion/cli/config";

// Los assets (audio, imágenes, sfx compartidos) viven en episodes/.
Config.setPublicDir("./episodes");
Config.setVideoImageFormat("jpeg");
