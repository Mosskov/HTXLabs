// Landing route: lists topic cards.
import { LabCardLink } from '@/components/LabCardLink';
import { format, strings } from '@/lab-guide/strings.da';
import { listTopics } from '@/lib/content';

export function Home() {
  const topics = listTopics();
  return (
    <div>
      <h1 className="text-3xl text-navy mb-2">{strings.brand}</h1>
      <p className="text-slate-600 mb-8">{strings.home.intro}</p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none pl-0">
        {topics.map((t) => (
          <LabCardLink
            key={t.frontmatter.id}
            to={`/emner/${t.frontmatter.id}`}
            title={t.frontmatter.title}
          >
            {t.frontmatter.subtitle && (
              <p className="text-sm text-slate-600">{t.frontmatter.subtitle}</p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              {format(strings.home.experimentCount, { n: t.experiments.length })}
            </p>
          </LabCardLink>
        ))}
      </ul>
    </div>
  );
}
