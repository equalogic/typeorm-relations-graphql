import { Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ImageFile } from './imagefile';
import { Product } from './product';

@Entity()
export class Image {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(_type => ImageFile)
  public sizeSmall: ImageFile;

  @ManyToOne(_type => ImageFile)
  public sizeMedium: ImageFile;

  @ManyToOne(_type => ImageFile)
  public sizeLarge: ImageFile;

  @ManyToOne(_type => Product)
  public product: Product;
}

export interface ImageSizeMap {
  small: ImageFile | null;
  medium: ImageFile | null;
  large: ImageFile | null;
}
