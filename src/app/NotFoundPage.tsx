import { Link } from "react-router-dom";

export function NotFoundPage(): JSX.Element {
  return (
    <section className="page-stack">
      <div className="section-header">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
      </div>
      <Link className="button button-primary" to="/orgs">
        View organizations
      </Link>
    </section>
  );
}

