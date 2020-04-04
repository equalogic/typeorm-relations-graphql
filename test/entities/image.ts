import { Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ImageFile } from './imagefile';

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
}

export interface ImageSizeMap {
  small: ImageFile | null;
  medium: ImageFile | null;
  large: ImageFile | null;
}
