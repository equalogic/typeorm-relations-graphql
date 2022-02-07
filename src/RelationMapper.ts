import { FragmentDefinitionNode, GraphQLResolveInfo, SelectionNode, SelectionSetNode } from 'graphql';
import { Connection, EntityMetadata, EntitySchema, ObjectType } from 'typeorm';
import { EmbeddedMetadata } from 'typeorm/metadata/EmbeddedMetadata';
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata';

export class RelationMapper {
  public constructor(private readonly connection: Connection) {}

  /*
   * Build the list of matching TypeORM relation property names for an entity, based on the `info` given to a GraphQL
   * query resolver.
   */
  public buildRelationListForQuery(
    entity: ObjectType<any> | EntitySchema<any> | string,
    info: GraphQLResolveInfo,
    path?: string,
  ): Set<string> {
    const rootNode = info.fieldNodes.find(fieldNode => fieldNode.name.value === info.fieldName);

    if (rootNode == null) {
      throw new Error(`Could not locate field named "${info.fieldName}" in query info"`);
    }

    const baseNode = path != null ? this.findQueryNode(path, info) : rootNode;

    if (baseNode == null) {
      throw new Error(`Could not locate field named "${path}" in query info"`);
    }

    return this.buildRelationList(entity, baseNode, info.fragments);
  }

  /*
   * Build the list of matching TypeORM relation property names for an entity, starting at a base SelectionNode.
   */
  public buildRelationList(
    entity: ObjectType<any> | EntitySchema<any> | string,
    baseNode: SelectionNode,
    fragments?: Record<string, FragmentDefinitionNode>,
    basePropertyPath?: string,
    currentLevel: number = 0,
  ): Set<string> {
    const relationNames = new Set<string>();
    const selectionSet = this.getSelectionSetFromNode(baseNode, fragments);

    if (selectionSet == null) {
      return relationNames;
    }

    // look for any relation properties among the selected fields inside the base node
    selectionSet.selections.forEach((selectionNode: SelectionNode) => {
      const currentPropertyPath: string[] = (basePropertyPath ?? '').split('.').filter(path => path !== '');
      let currentTargetEntity = entity;
      let nextLevel: number = currentLevel;

      const nodeName = this.getNameFromNode(selectionNode);

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
          if (propMetadata instanceof RelationMetadata) {
            currentTargetEntity = propMetadata.inverseEntityMetadata.target;
            nextLevel = currentLevel + 1;
            currentPropertyPath.push(propMetadata.propertyName);
            relationNames.add(currentPropertyPath.join('.'));
          } else if (propMetadata instanceof EmbeddedMetadata) {
            currentPropertyPath.push(propMetadata.propertyPath);
          }
        }
      }

      /*
       * Note: if the field is not a mapped property it's still possible that its children contain further
       * relation properties, so we continue to recurse as long as there are nested selection sets.
       */

      // recursively map nested relations
      const nestedRelations = this.buildRelationList(
        currentTargetEntity,
        selectionNode,
        fragments,
        currentPropertyPath.join('.'),
        nextLevel,
      );
      nestedRelations.forEach(nestedRelation => relationNames.add(nestedRelation));
    });

    return relationNames;
  }

  /*
   * Returns the SelectionNode for referenced field if it was selected in the GraphQL query, or null if it's not found.
   * `fieldPath` can locate nested fields using dotted 'parentField.childField.grandchildField' notation.
   */
  public findQueryNode(fieldPath: string, info: GraphQLResolveInfo): SelectionNode | null {
    const baseNode = info.fieldNodes.find(fieldNode => fieldNode.name.value === info.fieldName);

    if (baseNode == null) {
      throw new Error(`Could not locate field named "${info.fieldName}" in query info"`);
    }

    let currentBaseNode: SelectionNode = baseNode;
    const fieldPathNodes: (SelectionNode | null)[] = [];

    // loop through each level of the path and find the matching selection node, if it's selected
    fieldPath.split('.').forEach((fieldName): void => {
      const selectionSet = this.getSelectionSetFromNode(currentBaseNode, info.fragments);

      if (selectionSet == null) {
        return;
      }

      const foundNode = this.findFieldInSelection(fieldName, selectionSet, info.fragments);

      if (foundNode == null) {
        fieldPathNodes.push(null);

        return;
      }

      fieldPathNodes.push(foundNode);
      currentBaseNode = foundNode;
    });

    // in case of a bad field path
    if (fieldPathNodes.length === 0) {
      return null;
    }

    // if there are nulls in the array then we did not find selection nodes at every level of the field path
    if (fieldPathNodes.filter(node => node === null).length > 0) {
      return null;
    }

    return fieldPathNodes[fieldPathNodes.length - 1];
  }

  /*
   * Returns true if the referenced field was selected in the GraphQL query, or false if it's not found.
   * `fieldPath` can locate nested fields using dotted 'parentField.childField.grandchildField' notation.
   */
  public isFieldSelected(fieldPath: string, info: GraphQLResolveInfo): boolean {
    return this.findQueryNode(fieldPath, info) != null;
  }

  private getEntityMetadata(entity: ObjectType<any> | EntitySchema<any> | string): EntityMetadata {
    return this.connection.getMetadata(entity);
  }

  private getNameFromNode(selectionNode: SelectionNode): string | null {
    switch (selectionNode.kind) {
      case 'Field':
      case 'FragmentSpread':
        return selectionNode.name.value;
      case 'InlineFragment':
      default:
        return null;
    }
  }

  private getSelectionSetFromNode(
    selectionNode: SelectionNode,
    fragments?: Record<string, FragmentDefinitionNode>,
  ): SelectionSetNode | undefined {
    switch (selectionNode.kind) {
      case 'FragmentSpread':
        if (fragments == null || fragments[selectionNode.name.value] == null) {
          throw new Error(`Could not find the fragment named ${selectionNode.name.value} referenced in the query.`);
        }

        return fragments[selectionNode.name.value].selectionSet;
      case 'Field':
      case 'InlineFragment':
        return selectionNode.selectionSet;
    }
  }

  private findFieldInSelection(
    fieldName: string,
    selectionSet: SelectionSetNode,
    fragments?: Record<string, FragmentDefinitionNode>,
  ): SelectionNode | undefined {
    let foundNode: SelectionNode | undefined = undefined;

    for (const selectionNode of selectionSet.selections) {
      if (foundNode !== undefined) {
        break;
      }

      if (selectionNode.kind === 'InlineFragment' || selectionNode.kind === 'FragmentSpread') {
        const selectionSet = this.getSelectionSetFromNode(selectionNode, fragments);

        if (selectionSet === undefined) {
          break;
        }

        foundNode = this.findFieldInSelection(fieldName, selectionSet, fragments);

        break;
      }

      if (this.getNameFromNode(selectionNode) === fieldName) {
        foundNode = selectionNode;

        break;
      }
    }

    return foundNode;
  }
}
