import { GraphQLResolveInfo } from 'graphql';
import { IResolvers } from 'graphql-tools';
import { getConnection } from 'typeorm';
import { Product } from './entities/product';
import { Image, ImageSizeMap } from './entities/image';
import { RelationMapper } from '../src';

export interface TestResolverContext {
  resolveInfoHook: (info: GraphQLResolveInfo) => void;
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
    images: [Image!]
  }

  type Store {
    id: Int!
    name: String
    owner: Owner
  }

  type Image {
    id: Int!
    sizes: ImageSizeMap
  }

  type ImageFile {
    id: Int!
    fileName: String
  }

  type ImageSizeMap {
    small: ImageFile
    medium: ImageFile
    large: ImageFile
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
      context.resolveInfoHook(info);

      const connection = getConnection();

      return connection.getRepository(Product).find({
        relations: new RelationMapper(connection).buildRelationListForQuery(Product, info),
      });
    },
  },
  Image: {
    sizes(source: Image, args: any, context: TestResolverContext, info: GraphQLResolveInfo): ImageSizeMap {
      return {
        small: source.sizeSmall,
        medium: source.sizeMedium,
        large: source.sizeLarge,
      };
    },
  },
};
