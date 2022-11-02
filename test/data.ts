import { DataSource } from 'typeorm';
import { Country } from './entities/country';
import { Image } from './entities/image';
import { ImageFile } from './entities/imagefile';
import { Owner } from './entities/owner';
import { Product } from './entities/product';
import { Store } from './entities/store';
import { Video } from './entities/video';

export const dataSource = new DataSource({
  type: 'sqlite',
  database: 'test/test.sqlite',
  entities: [Country, Product, Owner, Store, Image, ImageFile, Video],
  synchronize: true,
  dropSchema: true,
});

export interface TestMockData {
  countryA: Country;
  ownerA: Owner;
  storeA: Store;
  productA: Product;
  imageA: Image;
  videoA: Video;
}

export const insertMockData = async (dataSource: DataSource): Promise<TestMockData> => {
  const countryRepo = dataSource.getRepository(Country);
  const ownerRepo = dataSource.getRepository(Owner);
  const storeRepo = dataSource.getRepository(Store);
  const productRepo = dataSource.getRepository(Product);
  const imageRepo = dataSource.getRepository(Image);
  const imageFileRepo = dataSource.getRepository(ImageFile);
  const videoRepo = dataSource.getRepository(Video);

  // COUNTRIES
  const countryA = await countryRepo.save(countryRepo.create({ name: 'Country A' }));

  // OWNERS
  const ownerA = await ownerRepo.save(
    ownerRepo.create({
      name: 'Owner A',
      address: {
        street: 'Street',
        country: countryA,
      },
    }),
  );

  // STORES
  const storeA = await storeRepo.save(
    storeRepo.create({
      name: 'Store A',
      owner: ownerA,
    }),
  );

  // PRODUCTS
  const productA = await productRepo.save(
    productRepo.create({
      name: 'Product A',
      owner: ownerA,
      store: storeA,
    }),
  );

  // IMAGES
  const imageA = await imageRepo.save(
    imageRepo.create({
      sizeSmall: await imageFileRepo.save(
        imageFileRepo.create({
          fileName: 'small.jpg',
        }),
      ),
      sizeMedium: await imageFileRepo.save(
        imageFileRepo.create({
          fileName: 'medium.jpg',
        }),
      ),
      sizeLarge: await imageFileRepo.save(
        imageFileRepo.create({
          fileName: 'large.jpg',
        }),
      ),
      product: productA,
    }),
  );

  // VIDEOS
  const videoA = await videoRepo.save(
    videoRepo.create({
      duration: 123,
      product: productA,
    }),
  );

  return {
    countryA,
    ownerA,
    storeA,
    productA,
    imageA,
    videoA,
  };
};
