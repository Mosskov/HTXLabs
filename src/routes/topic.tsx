import { strings } from '@/lab-guide/strings.da';
import { loadTopic } from '@/lib/content';
import { Link, useParams } from 'react-router-dom';

export function TopicRoute() {
  const { topic } = useParams();
  if (!topic) return null;
  const t = loadTopic(topic);
  if (!t) return <p>{strings.errors.notFound}</p>;
  return (
    <div>
      <Link to="/" className="text-sm text-accent hover:underline">
        ← Forsiden
      </Link>
      <h1 className="text-3xl text-navy mt-2 mb-1">{t.frontmatter.title}</h1>
      {t.frontmatter.subtitle && <p className="text-slate-600 mb-8">{t.frontmatter.subtitle}</p>}
      <ul className="grid grid-cols-1 gap-4 list-none pl-0">
        {t.experiments.map((e) => (
          <li key={e.slug} className="lab-card before:hidden">
            <Link
              to={`/emner/${t.frontmatter.id}/${e.slug}`}
              className="block p-5 hover:bg-slate-50 rounded-lg"
            >
              <h2 className="text-lg text-navy mb-1">{e.frontmatter.title}</h2>
              <ul className="text-sm text-slate-600 list-none pl-0">
                {e.frontmatter.learningObjectives.slice(0, 2).map((obj) => (
                  <li key={obj} className="before:hidden pl-0">
                    {obj}
                  </li>
                ))}
              </ul>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
