import { FindOptionsRelations } from 'typeorm';
import { addRelationByPath, isKeyOf, mergeRelations } from './util';

export class RelationMap<Entity extends InstanceType<any> = any> {
  private value: FindOptionsRelations<Entity>;

  public constructor(relations: FindOptionsRelations<Entity> = {}) {
    this.value = relations;
  }

  public valueOf(): FindOptionsRelations<Entity> {
    return this.value;
  }

  public toFindOptionsRelations(): FindOptionsRelations<Entity> {
    return this.value;
  }

  public add(source: RelationMap<Entity> | FindOptionsRelations<Entity> | keyof Entity | string[]): this {
    this.value = Array.isArray(source)
      ? addRelationByPath(this.value, source)
      : mergeRelations(
          this.value,
          source instanceof RelationMap
            ? source.valueOf()
            : isKeyOf<Entity>(source)
            ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              ({ [source]: true } as FindOptionsRelations<Entity>)
            : source,
        );

    return this;
  }
}
