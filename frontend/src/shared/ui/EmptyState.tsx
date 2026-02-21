export function EmptyState({ message }: { message: string }): JSX.Element {
  return <p className="empty-state">{message}</p>;
}
