import { Connection, EntityMetadata, EntitySchema } from 'typeorm';
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata';
import { FragmentDefinitionNode, GraphQLResolveInfo, SelectionNode, SelectionSetNode } from 'graphql';

export class RelationMapper {
  public constructor(private readonly connection: Connection) {}

  public buildRelationListForQuery(entity: Function | EntitySchema<any> | string, info: GraphQLResolveInfo): string[] {
    const field = info.fieldNodes.find(fieldNode => fieldNode.name.value === info.fieldName);

    if (field == null) {
      throw new Error(`Could not locate field named "${info.fieldName}" in query info"`);
    }

    return this.buildRelationList(entity, field, info.fragments);
  }

  public buildRelationList(
    entity: Function | EntitySchema<any> | string,
    baseNode: SelectionNode,
    fragments?: { [p: string]: FragmentDefinitionNode },
    basePropertyPath?: string,
  ): string[] {
    const relationNames: string[] = [];
    const selectionSet = this.getSelectionSetFromNode(baseNode, fragments);

    if (selectionSet == null) {
      return relationNames;
    }

    // look for any relation properties among the selected fields inside the base node
    selectionSet.selections.forEach((selectionNode: SelectionNode) => {
      const nodeName = this.getNameFromNode(selectionNode);
      let currentPropertyPath = basePropertyPath;

      // find relation metadata, if field corresponds to a relation property
      const relationMetadata = this.findRelationMetadata(nodeName, entity);

      if (relationMetadata != null) {
        // build up relation path by appending current property name
        currentPropertyPath = basePropertyPath
          ? `${basePropertyPath}.${relationMetadata.propertyName}`
          : relationMetadata.propertyName;

        // add the relation to the list
        relationNames.push(currentPropertyPath);
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
      relationNames.push(...nestedRelations);
    });

    return relationNames;
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

  private getNameFromNode(selectionNode: SelectionNode): string {
    switch (selectionNode.kind) {
      case 'Field':
      case 'FragmentSpread':
        return selectionNode.name.value;
      case 'InlineFragment':
        throw new Error('Cannot get node name for an InlineFragment.');
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
        return selectionNode.selectionSet;
      case 'InlineFragment':
        throw new Error('Support for InlineFragment nodes has not been implemented.'); // TODO: implement InlineFragment support
    }
  }
}
