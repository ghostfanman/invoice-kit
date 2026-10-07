// Startet den einzelnen Worker beim Serverstart (nur Node.js-Laufzeit).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getApp } = await import("./server/app");
    getApp();
  }
}
