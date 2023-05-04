import { FragmentDefinitionNode, GraphQLResolveInfo, SelectionNode } from 'graphql';
import { findSelectionNode, getNameFromNode, getSelectionSetFromNode } from 'graphql-info-inspector';
import { DataSource, EntityMetadata, EntitySchema, ObjectType } from 'typeorm';
import { RelationMap } from 'typeorm-relations';
import { isEmbeddedMetadata, isRelationMetadata } from './util/metadata';

export class GraphRelationBuilder {
  public constructor(private readonly dataSource: DataSource) {}

  /*
   * Build a map of matching TypeORM relation properties for an entity, based on the `info` given to a GraphQL
   * query resolver.
   */
  public buildForQuery<Entity extends InstanceType<any>>(
    entity: ObjectType<Entity> | EntitySchema<Entity> | string,
    info: GraphQLResolveInfo,
    path?: string,
  ): RelationMap<Entity> {
    const rootNode = info.fieldNodes.find(fieldNode => fieldNode.name.value === info.fieldName);

    if (rootNode == null) {
      throw new Error(`Could not locate field named "${info.fieldName}" in query info"`);
    }

    const baseNode = path != null ? findSelectionNode(path, info) : rootNode;

    if (baseNode == null) {
      throw new Error(`Could not locate field named "${path}" in query info"`);
    }

    return this.build(entity, baseNode, info.fragments);
  }

  /*
   * Build a map of matching TypeORM relation properties for an entity, starting at a base SelectionNode.
   */
  public build<Entity extends InstanceType<any>>(
    entity: ObjectType<Entity> | EntitySchema<Entity> | string,
    baseNode: SelectionNode,
    fragments?: Record<string, FragmentDefinitionNode>,
    basePropertyPath?: string,
    currentLevel: number = 0,
  ): RelationMap<Entity> {
    const relationMap = new RelationMap<Entity>();
    const selectionSet = getSelectionSetFromNode(baseNode, fragments);

    if (selectionSet == null) {
      return relationMap;
    }

    // look for any relation properties among the selected fields inside the base node
    selectionSet.selections.forEach((selectionNode: SelectionNode) => {
      const currentPropertyPath: string[] = (basePropertyPath ?? '').split('.').filter(path => path !== '');
      // eslint-disable-next-line @typescript-eslint/ban-types
      let currentTargetEntity = entity;
      let nextLevel: number = currentLevel;

      const nodeName = getNameFromNode(selectionNode);

      // when the node has a name (i.e. is not an inline fragment), we can look for relations to map
      if (nodeName != null) {
        // remove elements from path up to the level of the current entity
        const currentPropertyPathExcludingEntity = [...currentPropertyPath];
        currentPropertyPathExcludingEntity.splice(0, currentLevel);

        // then add the current node name to the end of the path
        const propPath = [...currentPropertyPathExcludingEntity, nodeName].join('.');

        // find relation or embedded entity metadata, if field corresponds to such a property on the entity
        const propMetadata =
          this.getEntityMetadata(currentTargetEntity).findRelationWithPropertyPath(propPath) ||
          this.getEntityMetadata(currentTargetEntity).findEmbeddedWithPropertyPath(propPath);

        if (propMetadata != null) {
          if (isRelationMetadata(propMetadata)) {
            currentTargetEntity = propMetadata.inverseEntityMetadata.target;
            nextLevel = currentLevel + 1;
            currentPropertyPath.push(propMetadata.propertyName);
            relationMap.add(currentPropertyPath);
          } else if (isEmbeddedMetadata(propMetadata)) {
            currentPropertyPath.push(propMetadata.propertyPath);
          }
        }
      }

      /*
       * Note: if the field is not a mapped property it's still possible that its children contain further
       * relation properties, so we continue to recurse as long as there are nested selection sets.
       */

      // recursively map nested relations
      const nestedRelations = this.build(
        currentTargetEntity,
        selectionNode,
        fragments,
        currentPropertyPath.join('.'),
        nextLevel,
      );
      relationMap.add(nestedRelations);
    });

    return relationMap;
  }

  private getEntityMetadata(entity: ObjectType<any> | EntitySchema | string): EntityMetadata {
    return this.dataSource.getMetadata(entity);
  }
}
