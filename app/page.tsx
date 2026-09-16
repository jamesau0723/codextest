/**
 * Homepage — the only route eligible to auto-show the entrance.
 *
 * A server component, so the site markup is in the HTML with or without
 * JavaScript. The `?media=` test seam is read client-side inside the gate.
 */
import { SiteShell } from '@/components/site/SiteShell';

export default function Page() {
  return <SiteShell eligible />;
}
