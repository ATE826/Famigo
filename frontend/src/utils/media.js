const HEIC_EXT = /\.(heic|heif)$/i;

const TYPES_BY_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

export function isHeic(file) {
  return /^image\/hei[cf]/i.test(file.type) || HEIC_EXT.test(file.name);
}

function typeOf(file) {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return TYPES_BY_EXTENSION[ext] ?? "";
}

// Приводит файл к виду, который покажет любой браузер: фото с iPhone (HEIC) превращаются в JPEG,
// файлам без типа (так бывает в Windows) тип определяется по расширению.
export async function prepareMedia(file) {
  if (isHeic(file)) {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    return { file: new File([blob], file.name.replace(HEIC_EXT, ".jpg"), { type: "image/jpeg" }), type: "image" };
  }
  const mime = typeOf(file);
  if (mime.startsWith("image/")) return { file: mime === file.type ? file : new File([file], file.name, { type: mime }), type: "image" };
  if (mime.startsWith("video/")) return { file: mime === file.type ? file : new File([file], file.name, { type: mime }), type: "video" };
  return null;
}
