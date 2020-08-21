import { graphql, GraphQLResolveInfo, GraphQLSchema } from 'graphql';
import { addMocksToSchema, makeExecutableSchema } from 'graphql-tools';
import { Connection, createConnection } from 'typeorm';
import { insertMockData, TestMockData } from '../test/data';
import { Country } from '../test/entities/country';
import { Image } from '../test/entities/image';
import { ImageFile } from '../test/entities/imagefile';
import { Owner } from '../test/entities/owner';
import { Product } from '../test/entities/product';
import { Store } from '../test/entities/store';
import { Video } from '../test/entities/video';
import { resolvers, typeDefs } from '../test/schema';
import { RelationMapper } from './RelationMapper';

describe('RelationMapper', () => {
  let connection: Connection;
  let mockData: TestMockData;
  let executableSchema: GraphQLSchema;

  beforeAll(async () => {
    // create database connection
    connection = await createConnection({
      type: 'sqlite',
      database: 'test/test.sqlite',
      entities: [Country, Product, Owner, Store, Image, ImageFile, Video],
      synchronize: true,
      dropSchema: true,
    });
    mockData = await insertMockData(connection);

    // create GraphQL schema
    executableSchema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });
    addMocksToSchema({
      schema: executableSchema,
      mocks: {},
      preserveResolvers: true,
    });
  });

  describe('buildRelationListForQuery()', () => {
    it('maps single-level GQL selections to ORM relations', async () => {
      // language=GraphQL
      const query = `
        query products {
          products {
            id
            name
            owner {
              id
              name
            }
            store {
              id
              name
            }
          }
        }
      `;

      const resolveInfoHook = (info: GraphQLResolveInfo): void => {
        const relations = new RelationMapper(connection).buildRelationListForQuery(Product, info);

        expect([...relations]).toEqual(['owner', 'store']);
      };
      const result = await graphql(executableSchema, query, {}, { resolveInfoHook });

      // check we hit our assertions inside the resolveInfoHook callback
      expect.assertions(1 + 4);

      // check the query result looks right
      expect(result).toBeDefined();
      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.products).toEqual([
        {
          id: expect.any(Number),
          name: mockData.productA.name,
          owner: {
            id: expect.any(Number),
            name: mockData.ownerA.name,
          },
          store: {
            id: expect.any(Number),
            name: mockData.storeA.name,
          },
        },
      ]);
    });

    it('maps multi-level GQL selections to ORM relations', async () => {
      // language=GraphQL
      const query = `
        query products {
          products {
            id
            name
            owner {
              id
              name
            }
            store {
              id
              name
              owner {
                id
                name
              }
            }
          }
        }
      `;

      const resolveInfoHook = (info: GraphQLResolveInfo): void => {
        const relations = new RelationMapper(connection).buildRelationListForQuery(Product, info);

        expect([...relations]).toEqual(['owner', 'store', 'store.owner']);
      };
      const result = await graphql(executableSchema, query, {}, { resolveInfoHook });

      // check we hit our assertions inside the resolveInfoHook callback
      expect.assertions(1 + 4);

      // check the query result looks right
      expect(result).toBeDefined();
      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.products).toEqual([
        {
          id: expect.any(Number),
          name: mockData.productA.name,
          owner: {
            id: expect.any(Number),
            name: mockData.ownerA.name,
          },
          store: {
            id: expect.any(Number),
            name: mockData.storeA.name,
            owner: {
              id: expect.any(Number),
              name: mockData.ownerA.name,
            },
          },
        },
      ]);
    });

    it('maps GQL selections containing spread fragments to ORM relations', async () => {
      // language=GraphQL
      const query = `
        fragment ProductFragment on Product {
          id
          name
          owner {
            ...OwnerFragment
          }
          store {
            ...StoreFragment
          }
        }

        fragment OwnerFragment on Owner {
          id
          name
        }

        fragment StoreFragment on Store {
          id
          name
          owner {
            id
            name
          }
        }

        query products {
          products {
            ...ProductFragment
          }
        }
      `;

      const resolveInfoHook = (info: GraphQLResolveInfo): void => {
        const relations = new RelationMapper(connection).buildRelationListForQuery(Product, info);

        expect([...relations]).toEqual(['owner', 'store', 'store.owner']);
      };
      const result = await graphql(executableSchema, query, {}, { resolveInfoHook });

      // check we hit our assertions inside the resolveInfoHook callback
      expect.assertions(1 + 4);

      // check the query result looks right
      expect(result).toBeDefined();
      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.products).toEqual([
        {
          id: expect.any(Number),
          name: mockData.productA.name,
          owner: {
            id: expect.any(Number),
            name: mockData.ownerA.name,
          },
          store: {
            id: expect.any(Number),
            name: mockData.storeA.name,
            owner: {
              id: expect.any(Number),
              name: mockData.ownerA.name,
            },
          },
        },
      ]);
    });

    it('accepts GQL selections containing inline fragments', async () => {
      // language=GraphQL
      const query = `
        fragment ProductFragment on Product {
          id
          name
          media {
            ... on Image {
              id
              sizes {
                medium {
                  id
                  fileName
                }
              }
              product {
                id
              }
            }
            ... on Video {
              id
              duration
              product {
                id
              }
            }
          }
        }

        query products {
          products {
            ...ProductFragment
          }
        }
      `;

      const resolveInfoHook = (info: GraphQLResolveInfo): void => {
        const relations = new RelationMapper(connection).buildRelationListForQuery(Product, info);

        expect([...relations]).toEqual([]);
      };
      const result = await graphql(executableSchema, query, {}, { resolveInfoHook });

      // check we hit our assertions inside the resolveInfoHook callback
      expect.assertions(1 + 4);

      // check the query result looks right
      expect(result).toBeDefined();
      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.products).toEqual([
        {
          id: mockData.productA.id,
          name: mockData.productA.name,
          media: [
            {
              id: mockData.imageA.id,
              sizes: {
                medium: mockData.imageA.sizeMedium,
              },
              product: {
                id: mockData.productA.id,
              },
            },
            {
              id: mockData.videoA.id,
              duration: mockData.videoA.duration,
              product: {
                id: mockData.productA.id,
              },
            },
          ],
        },
      ]);
    });
  });

  describe('isFieldSelected()', () => {
    it('finds simple nested field selections', async () => {
      // language=GraphQL
      const query = `
        query products {
          products {
            id
            name
            owner {
              id
              name
            }
            store {
              id
              name
              owner {
                id
                name
              }
            }
          }
        }
      `;

      const resolveInfoHook = (info: GraphQLResolveInfo): void => {
        const mapper = new RelationMapper(connection);

        expect(mapper.isFieldSelected('name', info)).toBe(true);
        expect(mapper.isFieldSelected('invalidField', info)).toBe(false);
        expect(mapper.isFieldSelected('owner', info)).toBe(true);
        expect(mapper.isFieldSelected('owner.name', info)).toBe(true);
        expect(mapper.isFieldSelected('store', info)).toBe(true);
        expect(mapper.isFieldSelected('store.name', info)).toBe(true);
        expect(mapper.isFieldSelected('store.owner', info)).toBe(true);
        expect(mapper.isFieldSelected('store.owner.name', info)).toBe(true);
      };
      await graphql(executableSchema, query, {}, { resolveInfoHook });

      expect.assertions(8);
    });

    it('finds nested non-entity relations', async () => {
      // language=GraphQL
      const query = `
        query products {
          products {
            id
            name
            images {
              sizes {
                medium {
                  id
                  fileName
                }
              }
            }
          }
        }
      `;

      const resolveInfoHook = (info: GraphQLResolveInfo): void => {
        const mapper = new RelationMapper(connection);

        expect(mapper.isFieldSelected('name', info)).toBe(true);
        expect(mapper.isFieldSelected('images.sizes', info)).toBe(true);
        expect(mapper.isFieldSelected('images.sizes.small', info)).toBe(false);
        expect(mapper.isFieldSelected('images.sizes.medium', info)).toBe(true);
        expect(mapper.isFieldSelected('images.sizes.medium.fileName', info)).toBe(true);
      };
      await graphql(executableSchema, query, {}, { resolveInfoHook });

      expect.assertions(5);
    });
  });
});
