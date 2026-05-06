import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, Unique } from "typeorm";
import { Country } from "./Country";
import { Place } from "./Place";
@Entity("city")
@Unique(["name", "country"])
export class City {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 10, unique: true, nullable: true })
  code: string;

  @ManyToOne(() => Country, (country) => country.city)
  country: Country;

  @OneToMany(() => Place, (place) => place.city)
  place: Place[];

  @CreateDateColumn()
  createdAt: Date;

}
