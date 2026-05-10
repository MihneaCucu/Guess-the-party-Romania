export function photoSrc(url: string): string {
  return url;
}

export function thumbnailSrc(url: string): string {
  if (url.startsWith("/photos/portraits/")) {
    return url.replace("/photos/portraits/", "/photos/thumbs/");
  }
  return url;
}

export function preloadPhoto(url: string, timeoutMs = 2500): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    let settled = false;
    const image = new window.Image();
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      image.src = "";
      resolve();
    }, timeoutMs);

    image.onload = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };
    image.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };
    image.src = url;
  });
}
