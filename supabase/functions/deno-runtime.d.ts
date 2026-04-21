/**
 * Minimal globals for checking Edge Function code with `tsc` (Deno provides these at runtime).
 */
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
  namespace env {
    function get(key: string): string | undefined;
  }
}
