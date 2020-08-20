import { Connection } from 'typeorm';
import { Owner } from './entities/owner';
import { Store } from './entities/store';
import { Product } from './entities/product';
import { Video } from './entities/video';
import { Image } from './entities/image';
import { ImageFile } from './entities/imagefile';

export interface TestMockData {
  ownerA: Owner;
  storeA: Store;
  productA: Product;
  imageA: Image;
  videoA: Video;
}

export const insertMockData = async (connection: Connection): Promise<TestMockData> => {
  const ownerRepo = connection.getRepository(Owner);
  const storeRepo = connection.getRepository(Store);
  const productRepo = connection.getRepository(Product);
  const imageRepo = connection.getRepository(Image);
  const imageFileRepo = connection.getRepository(ImageFile);
  const videoRepo = connection.getRepository(Video);

  // OWNERS
  const ownerA = await ownerRepo.save(ownerRepo.create({ name: 'Owner A' }));

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
    ownerA,
    storeA,
    productA,
    imageA,
    videoA,
  };
};
