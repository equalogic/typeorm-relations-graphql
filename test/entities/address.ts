import { Entity, Column, ManyToOne } from 'typeorm';
import { Country } from './country';

@Entity()
export class Address {
  @Column()
  public street: string;

  @ManyToOne(_type => Country)
  public country: Country;
}
