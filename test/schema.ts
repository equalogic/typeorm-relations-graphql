import { GraphQLResolveInfo } from 'graphql';
import { IResolvers } from 'graphql-tools';
import { Product } from './entities/product';
import { getConnection } from 'typeorm';

export interface TestResolverContext {
  buildRelations: (info: GraphQLResolveInfo) => string[];
}

// language=GraphQL
export const typeDefs = `
  type Owner {
    id: Int!
    name: String
  }

  type Product {
    id: Int!
    name: String
    owner: Owner
    store: Store
  }

  type Store {
    id: Int!
    name: String
  }

  type Query {
    products: [Product]!
  }

  schema {
    query: Query
  }
`;

export const resolvers: IResolvers<any, TestResolverContext> = {
  Query: {
    products(source: any, args: any, context: TestResolverContext, info: GraphQLResolveInfo): Promise<Product[]> {
      const relations = context.buildRelations(info);

      return getConnection().getRepository(Product).find({
        relations,
      });
    },
  },
};
