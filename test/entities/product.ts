import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Owner } from './owner';
import { Store } from './store';
import { Image } from './image';
import { Video } from './video';
import { OneToMany } from 'typeorm/index';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public name: string;

  @ManyToOne(_type => Owner)
  public owner: Owner;

  @ManyToOne(_type => Store)
  public store: Store;

  @OneToMany(_type => Image, image => image.product)
  public images: Image[];

  @OneToMany(_type => Video, video => video.product)
  public videos: Video[];
}
