import { Link } from 'react-router-dom';
import { listTopics } from '@/lib/content';

export function Home() {
  const topics = listTopics();
  return (
    <div>
      <h1 className="text-3xl text-navy mb-2">HTX Labs</h1>
      <p className="text-slate-600 mb-8">
        Interaktive fysikforsøg til HTX-elever. Vælg et emne for at komme i gang.
      </p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none pl-0">
        {topics.map((t) => (
          <li key={t.frontmatter.id} className="lab-card before:hidden">
            <Link
              to={`/emner/${t.frontmatter.id}`}
              className="block p-5 hover:bg-slate-50 rounded-lg"
            >
              <h2 className="text-lg text-navy mb-1">{t.frontmatter.title}</h2>
              {t.frontmatter.subtitle && (
                <p className="text-sm text-slate-600">{t.frontmatter.subtitle}</p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                {t.experiments.length}{' '}
                {t.experiments.length === 1 ? 'forsøg' : 'forsøg'}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
