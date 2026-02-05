import { AnnotationType } from '../types/annotations';

export interface AnnotationTypeConfig {
  id: AnnotationType;
  label: string;
  icon: string;
  color: string;
  cssVar: string;
}

export const ANNOTATION_TYPE_CONFIGS: AnnotationTypeConfig[] = [
  { id: 'comment', label: 'コメント', icon: '💬', color: '#4fc3f7', cssVar: 'var(--comment-color)' },
  { id: 'review', label: '校閲', icon: '✏️', color: '#81c784', cssVar: 'var(--review-color)' },
  { id: 'pending', label: '保留', icon: '⏳', color: '#ffb74d', cssVar: 'var(--pending-color)' },
  { id: 'discussion', label: '議論', icon: '💭', color: '#ba68c8', cssVar: 'var(--discussion-color)' },
];

export const ANNOTATION_TYPE_MAP: Record<AnnotationType, AnnotationTypeConfig> =
  Object.fromEntries(ANNOTATION_TYPE_CONFIGS.map(c => [c.id, c])) as Record<AnnotationType, AnnotationTypeConfig>;

export function getTypeConfig(type: AnnotationType): AnnotationTypeConfig {
  return ANNOTATION_TYPE_MAP[type] || ANNOTATION_TYPE_CONFIGS[0];
}
