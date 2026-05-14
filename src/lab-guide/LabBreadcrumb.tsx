// Compact breadcrumb heading shown on LabGuide pages in place of the large lab title: topic - lab - mode (topic and lab linked).
import { Link } from 'react-router-dom';
import type { Mode } from './runner';
import { strings } from './strings.da';

interface LabBreadcrumbProps {
  topicSlug: string;
  topicTitle: string;
  labSlug: string;
  labTitle: string;
  mode: Mode;
}

export function LabBreadcrumb({
  topicSlug,
  topicTitle,
  labSlug,
  labTitle,
  mode,
}: LabBreadcrumbProps) {
  return (
    <h1 className="text-xs font-semibold tracking-widest uppercase mb-2">
      <Link to={`/emner/${topicSlug}`} className="text-accent hover:underline">
        {topicTitle}
      </Link>
      <span className="text-slate-500"> - </span>
      <Link to={`/emner/${topicSlug}/${labSlug}`} className="text-accent hover:underline">
        {labTitle}
      </Link>
      <span className="text-slate-500"> - {strings.modes[mode]}</span>
    </h1>
  );
}
