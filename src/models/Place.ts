import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { City } from "./City";

@Entity("place")
export class Place {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 100 })
    name: string;

    @Column({ length: 50 })
    category: string;

    @ManyToOne(() => City, (city) => city.place)
    city: City;

    @CreateDateColumn()
    createdAt: Date;
}