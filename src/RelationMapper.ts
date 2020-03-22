import { Connection, EntityMetadata, EntitySchema } from 'typeorm';
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata';
import { FieldNode, FragmentDefinitionNode, GraphQLResolveInfo, SelectionNode } from 'graphql';

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

    // ignore FragmentSpreadNode and InlineFragmentNode
    if (baseNode.kind !== 'Field' || baseNode.selectionSet == null) {
      return relationNames;
    }

    // look for any relation properties among the selected fields inside the base node
    baseNode.selectionSet.selections.forEach((selectionNode: SelectionNode) => {
      // ignore FragmentSpreadNode and InlineFragmentNode
      if (selectionNode.kind !== 'Field') {
        return;
      }

      let currentPropertyPath = basePropertyPath;

      // find relation metadata, if field corresponds to a relation property
      const relationMetadata = this.findRelationMetadata(selectionNode, entity);

      if (relationMetadata != null) {
        // build up relation path by appending current property name
        currentPropertyPath = basePropertyPath
          ? `${basePropertyPath}.${relationMetadata.propertyName}`
          : relationMetadata.propertyName;

        // add the relation to the list
        relationNames.push(currentPropertyPath);
      }

      // Note: if the field is not a relation property it's still possible that its children contain further
      // relation properties, so we continue to recurse as long as there are nested selection sets.

      if (selectionNode.selectionSet == null) {
        return;
      }

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
    fieldNode: FieldNode,
    entity: Function | EntitySchema<any> | string,
  ): RelationMetadata | undefined {
    // find relation metadata, if field corresponds to a relation property
    return this.getRelationsMetadata(entity).find(
      relationMetadata => relationMetadata.propertyName === fieldNode.name.value,
    );
  }
}
