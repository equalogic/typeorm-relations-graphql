import mergeWith from 'lodash.mergewith';
import { FindOptionsRelations, FindOptionsRelationsProperty } from 'typeorm';

export function addRelationByPath<Entity>(
  relations: FindOptionsRelations<Entity>,
  path: string[],
): FindOptionsRelations<Entity> {
  const [property, nextProperty] = path;

  if (property == null) {
    return relations;
  }

  const result = { ...relations };

  if (!result[property]) {
    result[property] = nextProperty != null ? {} : true;
  }

  if (nextProperty != null) {
    return {
      ...result,
      [property]: addRelationByPath(result[property], path.slice(1)),
    };
  }

  return result;
}

export function mergeRelations<Entity>(
  relationsA: FindOptionsRelations<Entity>,
  relationsB: FindOptionsRelations<Entity>,
): FindOptionsRelations<Entity> {
  const result = { ...relationsA };

  mergeWith(
    result,
    relationsB,
    (
      valueA: FindOptionsRelationsProperty<any>,
      valueB: FindOptionsRelationsProperty<any>,
    ): FindOptionsRelationsProperty<any> | undefined => {
      // when valueB is falsy, keep valueA
      if (!valueB) {
        return valueA;
      }

      // when valueA is nullish or boolean, use valueB
      if (valueA == null || typeof valueA !== 'object') {
        return valueB;
      }

      // when valueA is a nested relation object and valueB is boolean, keep valueA
      if (typeof valueB !== 'object') {
        return valueA;
      }

      // both valueA and valueB are nested relation objects, so let lodash.merge recurse down
      return undefined;
    },
  );

  return result;
}

export function isKeyOf<Target>(key: unknown, target?: Target): key is keyof Target {
  return typeof key === 'string' && (target == null || key in target);
}
