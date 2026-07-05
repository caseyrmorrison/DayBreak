import { connection } from "next/server";
import DaybreakApp from "@/components/DaybreakApp";

export default async function Home() {
  // Nonce-based CSP requires dynamic rendering: the nonce is minted
  // per request in src/proxy.ts, so this page can never be prerendered.
  await connection();
  return <DaybreakApp />;
}
