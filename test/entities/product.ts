import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, ManyToMany } from 'typeorm';
import { Owner } from './owner';
import { Store } from './store';
import { Image } from './image';

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

  @ManyToMany(_type => Image)
  public images: Image[];
}
