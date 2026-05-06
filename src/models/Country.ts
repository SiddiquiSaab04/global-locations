import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn , OneToMany } from 'typeorm';
import { City } from './City';

@Entity('country')
export class Country {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100,unique: true })
  name: string;

  @Column({ length: 10, unique: true , nullable:true })
  code: string;

  @OneToMany(() => City, (city) => city.country)
  city: City[];

  @CreateDateColumn()
  createdAt: Date;

}