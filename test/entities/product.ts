import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Image } from './image';
import { Owner } from './owner';
import { Store } from './store';
import { Video } from './video';

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
