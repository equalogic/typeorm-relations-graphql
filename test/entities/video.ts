import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from './product';

@Entity()
export class Video {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public duration: number;

  @ManyToOne(_type => Product)
  public product: Product;
}
