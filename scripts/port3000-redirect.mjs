// Tiny courtesy server: Daybreak's dev server historically ran on
// :3000, so fingers keep typing it. Redirect everything to the real
// app on :3200 instead of leaving a dead port.
import { createServer } from "node:http";

const TARGET = "http://localhost:3200";

createServer((req, res) => {
  res.writeHead(308, { Location: `${TARGET}${req.url ?? "/"}` });
  res.end();
}).listen(3000, () => {
  console.log(`redirecting :3000 -> ${TARGET}`);
});
