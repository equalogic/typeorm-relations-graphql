import { addMocksToSchema } from '@graphql-tools/mock';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql, GraphQLResolveInfo, GraphQLSchema } from 'graphql';
import { dataSource, insertMockData, TestMockData } from '../test/data';
import { Product } from '../test/entities/product';
import { Store } from '../test/entities/store';
import { resolvers, typeDefs } from '../test/schema';
import { GraphRelationBuilder } from './GraphRelationBuilder';

describe('GraphRelationBuilder', () => {
  let mockData: TestMockData;
  let executableSchema: GraphQLSchema;

  beforeAll(async () => {
    // set up database
    await dataSource.initialize();
    mockData = await insertMockData(dataSource);

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

  describe('buildForQuery()', () => {
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
        const relationMap = new GraphRelationBuilder(dataSource).buildForQuery(Product, info);

        expect(relationMap.toFindOptionsRelations()).toEqual({
          owner: true,
          store: true,
        });
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
              address {
                street
                country {
                  id
                  name
                }
              }
            }
            store {
              id
              name
              owner {
                id
                name
                address {
                  street
                  country {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      `;

      const resolveInfoHook = (info: GraphQLResolveInfo): void => {
        const relationMap = new GraphRelationBuilder(dataSource).buildForQuery(Product, info);

        expect(relationMap.toFindOptionsRelations()).toEqual({
          owner: {
            address: {
              country: true,
            },
          },
          store: {
            owner: {
              address: {
                country: true,
              },
            },
          },
        });
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
            address: {
              street: mockData.ownerA.address.street,
              country: {
                id: mockData.countryA.id,
                name: mockData.countryA.name,
              },
            },
          },
          store: {
            id: expect.any(Number),
            name: mockData.storeA.name,
            owner: {
              id: expect.any(Number),
              name: mockData.ownerA.name,
              address: {
                street: mockData.ownerA.address.street,
                country: {
                  id: mockData.countryA.id,
                  name: mockData.countryA.name,
                },
              },
            },
          },
        },
      ]);
    });

    it('maps non-root level GQL selections (using field path) to ORM relations', async () => {
      // language=GraphQL
      const query = `
        query products {
          products {
            id
            name
            store {
              id
              name
              owner {
                id
                name
                address {
                  street
                  country {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      `;

      const resolveInfoHook = (info: GraphQLResolveInfo): void => {
        const relationMap = new GraphRelationBuilder(dataSource).buildForQuery(Store, info, 'store');

        expect(relationMap.toFindOptionsRelations()).toEqual({
          owner: {
            address: {
              country: true,
            },
          },
        });
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
          store: {
            id: expect.any(Number),
            name: mockData.storeA.name,
            owner: {
              id: expect.any(Number),
              name: mockData.ownerA.name,
              address: {
                street: mockData.ownerA.address.street,
                country: {
                  id: mockData.countryA.id,
                  name: mockData.countryA.name,
                },
              },
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
          address {
            street
            country {
              id
              name
            }
          }
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
        const relationMap = new GraphRelationBuilder(dataSource).buildForQuery(Product, info);

        expect(relationMap.toFindOptionsRelations()).toEqual({
          owner: {
            address: {
              country: true,
            },
          },
          store: {
            owner: true,
          },
        });
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
            address: {
              street: mockData.ownerA.address.street,
              country: {
                id: mockData.countryA.id,
                name: mockData.countryA.name,
              },
            },
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
        const relationMap = new GraphRelationBuilder(dataSource).buildForQuery(Product, info);

        expect(relationMap.toFindOptionsRelations()).toEqual({});
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
});
