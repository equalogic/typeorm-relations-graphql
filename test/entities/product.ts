import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Author } from './author';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public name: string;

  @ManyToOne(_type => Author)
  public author: Author;
}
