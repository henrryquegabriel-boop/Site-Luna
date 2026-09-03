import { json } from "../../../lib/api";

// Close the old endpoint too: stale tabs must not bypass the household roster.
export async function POST() {
  return json({ error: "A confirmação agora é por convite individual. Peça o link da sua família à organização." }, 410);
}
