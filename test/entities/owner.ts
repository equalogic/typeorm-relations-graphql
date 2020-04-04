import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Owner {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public name: string;
}
