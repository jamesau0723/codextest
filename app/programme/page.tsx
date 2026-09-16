/**
 * A deep link. The entrance never auto-shows here: the requested target is
 * preserved rather than redirected to the homepage.
 */
import { SiteShell } from '@/components/site/SiteShell';

export default function ProgrammePage() {
  return (
    <SiteShell eligible={false}>
      <section className="site-section">
        <h1>Programme</h1>
        <p id="faculty">Faculty</p>
        <p id="register">Register</p>
      </section>
    </SiteShell>
  );
}
