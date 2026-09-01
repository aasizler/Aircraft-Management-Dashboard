import { Icon, type IconName } from "./icon";

/**
 * What a section says when it has nothing in it.
 *
 * These were bare grey sentences — "Nothing scheduled.", "No policy on file." —
 * which read as an apology and left the reader to work out what to do next. An
 * empty state is the best chance to explain what a section is FOR: name the
 * space, say what lands here in one line, and offer the verb that starts it.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: string;
  /** The one thing to do from here. Omit where the section fills itself. */
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="empty">
      <span className="empty-ic"><Icon name={icon} size={20} /></span>
      <div className="empty-title">{title}</div>
      <p className="empty-body">{body}</p>
      {action && (
        <button className="btn sm" onClick={action.onClick}>{action.label}</button>
      )}
    </div>
  );
}
