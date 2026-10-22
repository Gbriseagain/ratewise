// Prepares a proof-of-address file before it is sent.
// Photos are shrunk and re-saved as JPEG on the device. Re-saving also strips
// hidden details such as where and when the photo was taken.

const MAX_SIDE = 2000;
const MAX_PHOTO = 1.5 * 1024 * 1024;
const MAX_PDF = 3 * 1024 * 1024;

export const PROOF_HELP =
  "A photo or PDF of a council tax bill, utility bill or poll card showing your name and this address. " +
  "Cover account numbers if you like. Only the Hindsight team sees it, and it is deleted as soon as it has been checked.";

function readAsBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("The file could not be read. Try another photo."));
    reader.readAsDataURL(blob);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That photo could not be opened here. Try a JPG or PNG, or take a screenshot of it."));
    };
    img.src = url;
  });
}

function toJpeg(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

// Returns { name, mime, base64, size }.
export async function prepareProof(file) {
  if (!file) throw new Error("Choose a photo or PDF first.");
  const name = file.name || "proof";
  if (file.type === "application/pdf" || /\.pdf$/i.test(name)) {
    if (file.size > MAX_PDF) throw new Error("That PDF is over 3 MB. Take a photo or screenshot of the letter instead.");
    return { name, mime: "application/pdf", base64: await readAsBase64(file), size: file.size };
  }
  if (file.type && !file.type.startsWith("image/")) throw new Error("Use a photo or a PDF.");

  const img = await loadImage(file);
  const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const scale = Math.min(1, MAX_SIDE / longest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let quality = 0.85;
  let blob = await toJpeg(canvas, quality);
  while (blob && blob.size > MAX_PHOTO && quality > 0.5) {
    quality -= 0.15;
    blob = await toJpeg(canvas, quality);
  }
  if (!blob) throw new Error("That photo could not be prepared. Try another one.");
  return { name, mime: "image/jpeg", base64: await readAsBase64(blob), size: blob.size };
}

export function sizeLabel(bytes) {
  if (!bytes) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
