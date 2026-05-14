// Eyebrow-styled back-link from a lab page to its parent topic.
import { Link } from 'react-router-dom';
import { format, strings } from './strings.da';

interface TopicBackLinkProps {
  topicSlug: string;
  topicTitle: string;
}

export function TopicBackLink({ topicSlug, topicTitle }: TopicBackLinkProps) {
  return (
    <Link
      to={`/emner/${topicSlug}`}
      className="flex w-fit text-xs font-semibold tracking-widest uppercase text-accent hover:underline mb-2"
    >
      {format(strings.nav.backToTopic, { topic: topicTitle })}
    </Link>
  );
}
