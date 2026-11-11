const EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export function fileNameOf(item, index = 0) {
  if (item.name) return item.name;
  const ext = EXTENSIONS[item.mime] ?? (item.type === "video" ? "mp4" : "jpg");
  return `famigo-${item.type === "video" ? "video" : "photo"}-${index + 1}.${ext}`;
}

export function downloadItem(item, index = 0) {
  const link = document.createElement("a");
  link.href = item.url;
  link.download = fileNameOf(item, index);
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function downloadMany(items) {
  for (let i = 0; i < items.length; i += 1) {
    downloadItem(items[i], i);
    if (i < items.length - 1) await new Promise((resolve) => setTimeout(resolve, 350));
  }
}
