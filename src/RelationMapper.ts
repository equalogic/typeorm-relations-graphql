import { Connection, EntityMetadata, EntitySchema } from 'typeorm';
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata';
import { FragmentDefinitionNode, GraphQLResolveInfo, SelectionNode, SelectionSetNode } from 'graphql';

export class RelationMapper {
  public constructor(private readonly connection: Connection) {}

  /*
   * Build the list of matching TypeORM relation property names for an entity, based on the `info` given to a GraphQL
   * query resolver.
   */
  public buildRelationListForQuery(
    entity: Function | EntitySchema<any> | string,
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
    entity: Function | EntitySchema<any> | string,
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
      const nodeName = this.getNameFromNode(selectionNode);
      let currentPropertyPath = basePropertyPath;

      // find relation metadata, if field corresponds to a relation property
      // note: nodeName will be null if current node is an inline fragment, in that case we just continue recursion
      const relationMetadata = nodeName != null ? this.findRelationMetadata(nodeName, entity) : undefined;

      if (relationMetadata != null) {
        // build up relation path by appending current property name
        currentPropertyPath = basePropertyPath
          ? `${basePropertyPath}.${relationMetadata.propertyName}`
          : relationMetadata.propertyName;

        // add the relation to the list
        relationNames.add(currentPropertyPath);
      }

      /*
       * Note: if the field is not a relation property it's still possible that its children contain further
       * relation properties, so we continue to recurse as long as there are nested selection sets.
       */

      // recursively map nested relations
      const nestedRelations = this.buildRelationList(
        relationMetadata ? relationMetadata.inverseEntityMetadata.target : entity,
        selectionNode,
        fragments,
        currentPropertyPath,
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

  private getEntityMetadata(entity: Function | EntitySchema<any> | string): EntityMetadata {
    return this.connection.getMetadata(entity);
  }

  private getRelationsMetadata(entity: Function | EntitySchema<any> | string): RelationMetadata[] {
    return this.getEntityMetadata(entity).relations;
  }

  private findRelationMetadata(
    nodeName: string,
    entity: Function | EntitySchema<any> | string,
  ): RelationMetadata | undefined {
    // find relation metadata, if field corresponds to a relation property
    return this.getRelationsMetadata(entity).find(relationMetadata => relationMetadata.propertyName === nodeName);
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
    return selectionSet.selections.find(selectionNode => this.getNameFromNode(selectionNode) === fieldName);
  }
}
