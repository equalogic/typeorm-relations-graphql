import { Connection, createConnection } from 'typeorm';
import { graphql, GraphQLResolveInfo, GraphQLSchema } from 'graphql';
import { addMockFunctionsToSchema, makeExecutableSchema } from 'graphql-tools';
import { RelationMapper } from './RelationMapper';
import { Product } from '../test/entities/product';
import { Author } from '../test/entities/author';
import { resolvers, typeDefs } from '../test/schema';

describe('RelationMapper', () => {
  let connection: Connection;
  let executableSchema: GraphQLSchema;

  beforeAll(async () => {
    // create database connection
    connection = await createConnection({
      type: 'sqlite',
      database: 'test/test.sqlite',
      entities: [Product, Author],
      synchronize: true,
      dropSchema: true,
    });

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

  it('maps GQL selections to ORM relations', async () => {
    let relations: string[] = [];

    // language=GraphQL
    const query = `
      query products {
        products {
          id
          name
          author {
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
    expect(relations).toEqual(['author']);

    // check the query result looks right
    expect(result).toBeDefined();
    expect(result.errors).toBeUndefined();
    expect(result.data).toBeDefined();
    expect(result.data?.products).toBeInstanceOf(Array);
  });
});
