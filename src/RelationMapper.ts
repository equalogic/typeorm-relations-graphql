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
  ): Set<string> {
    const baseNode = info.fieldNodes.find(fieldNode => fieldNode.name.value === info.fieldName);

    if (baseNode == null) {
      throw new Error(`Could not locate field named "${info.fieldName}" in query info"`);
    }

    return this.buildRelationList(entity, baseNode, info.fragments);
  }

  /*
   * Build the list of matching TypeORM relation property names for an entity, starting at a base SelectionNode.
   */
  public buildRelationList(
    entity: ObjectType<any> | EntitySchema<any> | string,
    baseNode: SelectionNode,
    fragments?: { [p: string]: FragmentDefinitionNode },
    basePropertyPath?: string,
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

      const nodeName = this.getNameFromNode(selectionNode);

      // when the node has a name (i.e. is not an inline fragment), we can look for relations to map
      if (nodeName != null) {
        // remove first element from path (the path of this field on the entity should not include the entity itself)
        const currentPropertyPathExcludingFirstElement = [...currentPropertyPath];
        currentPropertyPathExcludingFirstElement.shift();

        // then add the current node name to the end of the path
        const propPath = [...currentPropertyPathExcludingFirstElement, nodeName].join('.');

        // find relation or embedded entity metadata, if field corresponds to such a property on the entity
        const propMetadata =
          this.getEntityMetadata(currentTargetEntity).findRelationWithPropertyPath(propPath) ||
          this.getEntityMetadata(currentTargetEntity).findEmbeddedWithPropertyPath(propPath);

        if (propMetadata != null) {
          if (propMetadata instanceof RelationMetadata) {
            currentTargetEntity = propMetadata.inverseEntityMetadata.target;
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
      );
      nestedRelations.forEach(nestedRelation => relationNames.add(nestedRelation));
    });

    return relationNames;
  }

  /*
   * Returns true if the referenced field was selected in the GraphQL query, or false if it's not found.
   * `fieldPath` can locate nested fields using dotted 'parentField.childField.grandchildField' notation.
   */
  public isFieldSelected(fieldPath: string, info: GraphQLResolveInfo): boolean {
    const baseNode = info.fieldNodes.find(fieldNode => fieldNode.name.value === info.fieldName);

    if (baseNode == null) {
      throw new Error(`Could not locate field named "${info.fieldName}" in query info"`);
    }

    let currentBaseNode: SelectionNode = baseNode;
    const fieldPathNodes: (SelectionNode | null)[] = [];

    // loop through each level of the path and find the matching selection node, if it's selected
    fieldPath.split('.').forEach(fieldName => {
      const selectionSet = this.getSelectionSetFromNode(currentBaseNode, info.fragments);

      if (selectionSet == null) {
        return false;
      }

      const foundNode = this.findFieldInSelection(fieldName, selectionSet);

      if (foundNode == null) {
        fieldPathNodes.push(null);

        return;
      }

      fieldPathNodes.push(foundNode);
      currentBaseNode = foundNode;
    });

    // if there are NO nulls in the array then we successfully found selection nodes at every level of the field path
    return fieldPathNodes.find(node => node === null) === undefined;
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
        return null;
    }
  }

  private getSelectionSetFromNode(
    selectionNode: SelectionNode,
    fragments?: { [p: string]: FragmentDefinitionNode },
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

  private findFieldInSelection(fieldName: string, selectionSet: SelectionSetNode): SelectionNode | undefined {
    let foundNode: SelectionNode | undefined = undefined;

    for (const selectionNode of selectionSet.selections) {
      if (foundNode !== undefined) {
        break;
      }

      if (selectionNode.kind === 'InlineFragment') {
        foundNode = this.findFieldInSelection(fieldName, selectionNode.selectionSet);

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
