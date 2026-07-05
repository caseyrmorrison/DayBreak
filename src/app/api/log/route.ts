// Temporary diagnostics endpoint — pairs with public/debug-hook.js.
// Logs client-side boot/error beacons to the server console so a
// stuck browser can be debugged. Remove with the hook when done.
export async function POST(request: Request) {
  const text = (await request.text()).slice(0, 4096);
  console.log(`[client-log ${new Date().toISOString()}] ${text}`);
  return new Response(null, { status: 204 });
}
