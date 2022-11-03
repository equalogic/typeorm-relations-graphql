import { addRelationByPath, mergeRelations } from './util';

describe('util', () => {
  describe('addRelationByPath', () => {
    it('correctly adds a single-level relation', () => {
      const relations = addRelationByPath({ bar: true }, ['foo']);

      expect(relations).toEqual({
        bar: true,
        foo: true,
      });
    });

    it('correctly adds a multi-level relation', () => {
      const relations = addRelationByPath({ xyzzy: true, foo: true }, ['foo', 'bar', 'baz']);

      expect(relations).toEqual({
        xyzzy: true,
        foo: {
          bar: {
            baz: true,
          },
        },
      });
    });
  });

  describe('mergeRelations', () => {
    it('correctly merges simple boolean relations', () => {
      const relations = mergeRelations<any>({ foo: true }, { bar: true });

      expect(relations).toEqual({
        foo: true,
        bar: true,
      });
    });

    it('correctly merges complex nested relations', () => {
      const relations = mergeRelations<any>(
        {
          foo: {
            bar: {
              baz: true,
            },
            xyzzy: true,
          },
        },
        {
          foo: {
            bar: true,
            xyzzy: {
              zyxxy: true,
            },
          },
        },
      );

      expect(relations).toEqual({
        foo: {
          bar: {
            baz: true,
          },
          xyzzy: {
            zyxxy: true,
          },
        },
      });
    });
  });
});
