import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ImageFile {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public fileName: string;
}
