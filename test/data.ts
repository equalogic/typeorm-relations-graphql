import { Connection } from 'typeorm';
import { Owner } from './entities/owner';
import { Store } from './entities/store';
import { Product } from './entities/product';

export interface TestMockData {
  ownerA: Owner;
  storeA: Store;
  productA: Product;
}

export const insertMockData = async (connection: Connection): Promise<TestMockData> => {
  const ownerRepo = connection.getRepository(Owner);
  const storeRepo = connection.getRepository(Store);
  const productRepo = connection.getRepository(Product);

  const ownerA = ownerRepo.create({ name: 'Owner A' });
  await ownerRepo.save(ownerA);

  const storeA = storeRepo.create({
    name: 'Store A',
    owner: ownerA,
  });
  await storeRepo.save(storeA);

  const productA = productRepo.create({
    name: 'Product A',
    owner: ownerA,
    store: storeA,
  });
  await productRepo.save(productA);

  return {
    ownerA,
    storeA,
    productA,
  };
};
