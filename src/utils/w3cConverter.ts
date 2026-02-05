import {
  AnnotationV2,
  AnnotationType,
  W3CTextAnnotation,
  W3CSelector,
  TextQuoteSelector,
  TextPositionSelector,
  AnnotationSelector,
  AnnotationReply,
} from '../types/annotations';
import { v4 as uuidv4 } from 'uuid';

/**
 * AnnotationV2 → W3C Web Annotation形式に変換
 * text-annotator-jsで使用するため
 */
export function toW3CAnnotation(annotation: AnnotationV2): W3CTextAnnotation {
  const w3cSelectors: W3CSelector[] = [];

  for (const selector of annotation.target.selectors) {
    if (selector.type === 'TextQuoteSelector') {
      w3cSelectors.push({
        type: 'TextQuoteSelector',
        exact: selector.exact,
        prefix: selector.prefix,
        suffix: selector.suffix,
      });
    } else if (selector.type === 'TextPositionSelector') {
      w3cSelectors.push({
        type: 'TextPositionSelector',
        start: selector.start,
        end: selector.end,
      });
    }
    // EditorPositionSelectorはW3Cにはないのでスキップ
  }

  return {
    id: annotation.id,
    '@context': 'http://www.w3.org/ns/anno.jsonld',
    type: 'Annotation',
    body: [
      {
        type: 'TextualBody',
        purpose: 'commenting',
        value: annotation.content,
      },
    ],
    target: {
      selector: w3cSelectors.length === 1 ? w3cSelectors[0] : w3cSelectors,
    },
  };
}

/**
 * text-annotator-jsのアノテーション → AnnotationV2に変換
 */
export function fromTextAnnotatorAnnotation(
  taAnnotation: W3CTextAnnotation,
  type: AnnotationType,
  content: string,
  filePath: string,
  author: string = 'user'
): AnnotationV2 {
  const target = taAnnotation.target;
  const selectors: AnnotationSelector[] = [];

  // W3CセレクタをAnnotationSelector[]に変換
  const rawSelectors = Array.isArray(target.selector)
    ? target.selector
    : [target.selector];

  for (const sel of rawSelectors) {
    if (sel.type === 'TextQuoteSelector') {
      selectors.push({
        type: 'TextQuoteSelector',
        exact: sel.exact,
        prefix: sel.prefix,
        suffix: sel.suffix,
      });
    } else if (sel.type === 'TextPositionSelector') {
      selectors.push({
        type: 'TextPositionSelector',
        start: sel.start,
        end: sel.end,
      });
    }
  }

  const now = new Date().toISOString();

  return {
    id: taAnnotation.id || uuidv4(),
    type,
    target: {
      source: filePath,
      selectors,
    },
    content,
    author,
    createdAt: now,
    status: 'active',
    replies: [],
  };
}

/**
 * AnnotationV2の配列をtext-annotator-jsにロードできるW3C形式に一括変換
 * activeでresolvedでない注釈のみ変換
 */
export function toW3CAnnotations(annotations: AnnotationV2[]): W3CTextAnnotation[] {
  return annotations
    .filter(a => a.status === 'active')
    .map(toW3CAnnotation);
}
