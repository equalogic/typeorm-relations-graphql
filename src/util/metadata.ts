import { EmbeddedMetadata } from 'typeorm/metadata/EmbeddedMetadata';
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata';

export function isRelationMetadata(metadata: Record<string, any>): metadata is RelationMetadata {
  if (metadata instanceof RelationMetadata) {
    return true;
  }

  if ('inverseEntityMetadata' in metadata) {
    return true;
  }

  return false;
}

export function isEmbeddedMetadata(metadata: Record<string, any>): metadata is EmbeddedMetadata {
  if (metadata instanceof EmbeddedMetadata) {
    return true;
  }

  if ('propertyPath' in metadata) {
    return true;
  }

  return false;
}
