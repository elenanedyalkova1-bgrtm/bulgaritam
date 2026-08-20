const BASEROW_API = "https://api.baserow.io/api";

export function baserowUrl(pathOrUrl) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const url = new URL(pathOrUrl);
    if (url.hostname !== "api.baserow.io") throw new Error("Invalid Baserow API URL");
    url.protocol = "https:";
    return url.toString();
  }
  if (/https?:\/\//i.test(pathOrUrl)) throw new Error("Invalid Baserow API URL");
  return `${BASEROW_API}/${pathOrUrl.replace(/^\/+/, "")}`;
}
