// A slow connection must not leave the family stuck in an endless loading state.
export async function clientFetch(input: RequestInfo | URL, options: RequestInit = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 20_000);
  try { return await fetch(input, { ...options, signal: controller.signal }); }
  catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) throw new Error("A conexão demorou mais que o esperado. Tente novamente ou recarregue a resposta salva.");
    throw error;
  } finally { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); }
}
