import { IResolvers } from '@graphql-tools/utils';
import { GraphQLResolveInfo } from 'graphql';
import { isFieldSelected } from 'graphql-info-inspector';
import { RelationMapper } from '../src';
import { dataSource } from './data';
import { Image, ImageSizeMap } from './entities/image';
import { Product } from './entities/product';
import { Video } from './entities/video';

export interface TestResolverContext {
  resolveInfoHook: (info: GraphQLResolveInfo) => void;
}

// language=GraphQL
export const typeDefs = `
  type Country {
    id: Int!
    name: String
  }

  type Address {
    street: String
    country: Country
  }

  type Owner {
    id: Int!
    name: String
    address: Address
  }

  type Product {
    id: Int!
    name: String
    owner: Owner
    store: Store
    images: [Image!]
    videos: [Video!]
    media: [MediaTypeUnion!]
  }

  type Store {
    id: Int!
    name: String
    owner: Owner
  }

  type Image {
    id: Int!
    sizes: ImageSizeMap
    product: Product!
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

  type Video {
    id: Int!
    duration: Int!
    product: Product!
  }

  union MediaTypeUnion = Image | Video

  type Query {
    products: [Product]!
  }

  schema {
    query: Query
  }
`;

export const resolvers: IResolvers<any, TestResolverContext> = {
  Query: {
    products(
      source: unknown,
      args: unknown,
      context: TestResolverContext,
      info: GraphQLResolveInfo,
    ): Promise<Product[]> {
      context.resolveInfoHook(info);

      const productMap = new RelationMapper(dataSource).buildForQuery(Product, info);

      return dataSource.getRepository(Product).find({
        relations: productMap.toFindOptionsRelations(),
      });
    },
  },
  Image: {
    sizes(source: Image): ImageSizeMap {
      return {
        small: source.sizeSmall,
        medium: source.sizeMedium,
        large: source.sizeLarge,
      };
    },
  },
  Product: {
    async media(
      source: Product,
      args: unknown,
      context: TestResolverContext,
      info: GraphQLResolveInfo,
    ): Promise<(Image | Video)[]> {
      const relationMapper = new RelationMapper(dataSource);
      const imageRelationMap = relationMapper.buildForQuery(Image, info);
      const videoRelationMap = relationMapper.buildForQuery(Video, info);

      // TODO: these kind of relations can't be mapped automatically yet
      if (isFieldSelected('sizes.small', info)) {
        imageRelationMap.add('sizeSmall');
      }

      if (isFieldSelected('sizes.medium', info)) {
        imageRelationMap.add('sizeMedium');
      }

      if (isFieldSelected('sizes.large', info)) {
        imageRelationMap.add('sizeLarge');
      }

      const images = await dataSource.getRepository(Image).find({
        where: {
          product: source,
        },
        relations: imageRelationMap.valueOf(),
      });
      const videos = await dataSource.getRepository(Video).find({
        where: {
          product: source,
        },
        relations: videoRelationMap.toFindOptionsRelations(),
      });

      return [...images, ...videos];
    },
  },
  MediaTypeUnion: {
    __resolveType(value: Image | Video): 'Image' | 'Video' | null {
      if (value instanceof Image) {
        return 'Image';
      }

      if (value instanceof Video) {
        return 'Video';
      }

      return null;
    },
  },
};
