import { Connection, createConnection } from 'typeorm';
import { graphql, GraphQLResolveInfo, GraphQLSchema } from 'graphql';
import { addMockFunctionsToSchema, makeExecutableSchema } from 'graphql-tools';
import { RelationMapper } from './RelationMapper';
import { Product } from '../test/entities/product';
import { Owner } from '../test/entities/owner';
import { Store } from '../test/entities/store';
import { resolvers, typeDefs } from '../test/schema';
import { insertMockData, TestMockData } from '../test/data';

describe('RelationMapper', () => {
  let connection: Connection;
  let mockData: TestMockData;
  let executableSchema: GraphQLSchema;

  beforeAll(async () => {
    // create database connection
    connection = await createConnection({
      type: 'sqlite',
      database: 'test/test.sqlite',
      entities: [Product, Owner, Store],
      synchronize: true,
      dropSchema: true,
    });
    mockData = await insertMockData(connection);

    // create GraphQL schema
    executableSchema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });
    addMockFunctionsToSchema({
      schema: executableSchema,
      mocks: {},
      preserveResolvers: true,
    });
  });

  it('maps single-level GQL selections to ORM relations', async () => {
    let relations: string[] = [];

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

    const result = await graphql(
      executableSchema,
      query,
      {},
      {
        buildRelations: (info: GraphQLResolveInfo): string[] => {
          relations = new RelationMapper(connection).buildRelationListForQuery(Product, info);

          return relations;
        },
      },
    );

    // check we built the correct list of relations
    expect(relations).toEqual(['owner', 'store']);

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
    let relations: string[] = [];

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

    const result = await graphql(
      executableSchema,
      query,
      {},
      {
        buildRelations: (info: GraphQLResolveInfo): string[] => {
          relations = new RelationMapper(connection).buildRelationListForQuery(Product, info);

          return relations;
        },
      },
    );

    // check we built the correct list of relations
    expect(relations).toEqual(['owner', 'store', 'store.owner']);

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

  it('maps GQL selections containing fragments to ORM relations', async () => {
    let relations: string[] = [];

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

    const result = await graphql(
      executableSchema,
      query,
      {},
      {
        buildRelations: (info: GraphQLResolveInfo): string[] => {
          relations = new RelationMapper(connection).buildRelationListForQuery(Product, info);

          return relations;
        },
      },
    );

    // check we built the correct list of relations
    expect(relations).toEqual(['owner', 'store', 'store.owner']);

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
});
