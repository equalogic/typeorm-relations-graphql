import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Author {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public name: string;
}
