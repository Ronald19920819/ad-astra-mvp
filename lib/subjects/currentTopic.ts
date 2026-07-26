export function resolveCurrentTopicTitle({
  topicTitle,
  lessonTitle,
}: {
  topicTitle: string | null | undefined;
  lessonTitle: string | null | undefined;
}) {
  return topicTitle?.trim() || lessonTitle?.trim() || null;
}
