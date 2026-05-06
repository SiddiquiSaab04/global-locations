import { Request, Response } from "express";
import axios from "axios";
import cron from "node-cron";
import { AppDataSource } from "../config/db";
import { Country } from "../models/Country";
import { City } from "../models/City";
import { Place } from "../models/Place";

// Overpass API URL
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// simple delay (VERY IMPORTANT)
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Batch tracking index
let currentBatchIndex = 0;

cron.schedule('10 1 * * *', async () => { // Runs daily at 6 AM
    console.log('Cron job started: processing next batch of countries');
    
    try {
        // Fetch all countries once
        const response = await axios.get(
            "https://restcountries.com/v3.1/all?fields=name"
        );
        const countries = response.data;

        // Select batch of 5 countries
        const batch = countries.slice(currentBatchIndex, currentBatchIndex + 5);

        for (const c of batch) {
            const countryName = c.name.common;

            // Check for duplicate country
            let countryRepo = AppDataSource.getRepository(Country);
            let country = await countryRepo.findOneBy({ name: countryName });
            
            if (!country) {
                country = new Country();
                country.name = countryName;
                country = await countryRepo.save(country);
            }

            console.log(`🌍 Country: ${country.name}`);
            await fetchCities(country.id, country.name);

            await delay(1500); // Prevent API block
        }

        // Move to the next batch index
        currentBatchIndex += 5;
        if (currentBatchIndex >= countries.length) {
            currentBatchIndex = 0; // Reset after all countries are processed
        }

    } catch (err) {
        console.error('Cron job error:', err);
    }
});

export const ingestData = async (req: Request, res: Response) => {
    try {
        // This will be the same logic but for manual runs
        const countryRepo = AppDataSource.getRepository(Country);

        // Get all countries once
        const response = await axios.get(
            "https://restcountries.com/v3.1/all?fields=name"
        );

        const countries = response.data;

        for (const c of countries) {
            const countryName = c.name.common;

            // Check for duplicate country
            let country = await countryRepo.findOneBy({ name: countryName });
            
            if (!country) {
                country = new Country();
                country.name = countryName;
                country = await countryRepo.save(country);
            }

            console.log(`🌍 Country: ${country.name}`);
            await fetchCities(country.id, country.name);

            await delay(1500); // Prevent API block
        }

        return res.json({ status: "success", message: "Data ingestion completed" });

    } catch (error) {
        console.error(error);
        return res.json({ status: "error", message: "Failed" });
    }
};

// ================= CITIES =================

const fetchCities = async (countryId: number, countryName: string, retries = 3) => {
    const cityRepo = AppDataSource.getRepository(City);

    try {
        const query = `
            [out:json][timeout:30];
            area[name="${countryName}"]["admin_level"="2"]->.searchArea;
            (
              node["place"="city"](area.searchArea);
              node["place"="town"](area.searchArea);
            );
            out body 15;
        `;

        const res = await axios.post(
            OVERPASS_URL,
            `data=${encodeURIComponent(query)}`,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "FetchLocationsApp/1.0",
                    "Accept": "application/json"
                },
                timeout: 45000 // 45 seconds timeout
            }
        );

        const cities = res.data?.elements || [];

        for (const c of cities) {
            if (!c.tags?.name) continue;

            let city = await cityRepo.findOne({
                where: { name: c.tags.name, country: { id: countryId } },
                relations: ["country"]
            });

            if (!city) {
                city = new City();
                city.name = c.tags.name;
                city.country = { id: countryId } as any;

                city = await cityRepo.save(city);
            }

            console.log(`   🏙️ City: ${city.name}`);
            await fetchPlaces(city.id, city.name);

            await delay(2000); // Increased delay
        }

    } catch (err: any) {
        if ((err.response?.status === 429 || err.response?.status === 504) && retries > 0) {
            console.log(`⚠️ Overpass API busy/rate-limited for ${countryName}. Retrying in 10s... (${retries} left)`);
            await delay(10000);
            return fetchCities(countryId, countryName, retries - 1);
        }
        console.error(`❌ Cities error for ${countryName}`, err.message || err);
    }
};

// ================= PLACES =================

const fetchPlaces = async (cityId: number, cityName: string, retries = 2) => {
    const placeRepo = AppDataSource.getRepository(Place);

    try {
        const query = `
            [out:json][timeout:30];
            area[name="${cityName}"]->.searchArea;
            (
              node["tourism"="museum"](area.searchArea);
              node["leisure"="park"](area.searchArea);
              node["historic"="monument"](area.searchArea);
              node["tourism"="viewpoint"](area.searchArea);
            );
            out body 10;
        `;

        const res = await axios.post(
            OVERPASS_URL,
            `data=${encodeURIComponent(query)}`,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "FetchLocationsApp/1.0",
                    "Accept": "application/json"
                },
                timeout: 45000
            }
        );

        const places = res.data?.elements || [];

        for (const p of places) {
            if (!p.tags?.name) continue;

            let existing = await placeRepo.findOne({
                where: { name: p.tags.name, city: { id: cityId } },
                relations: ["city"]
            });

            if (!existing) {
                const place = new Place();
                place.name = p.tags.name;

                place.category =
                    p.tags.tourism ||
                    p.tags.leisure ||
                    p.tags.historic ||
                    "place";

                place.city = { id: cityId } as any;

                await placeRepo.save(place);
            }

            console.log(`      📍 Place: ${p.tags.name}`);
        }

    } catch (err: any) {
        if ((err.response?.status === 429 || err.response?.status === 504) && retries > 0) {
            console.log(`⚠️ Overpass API busy for ${cityName}. Retrying in 5s...`);
            await delay(5000);
            return fetchPlaces(cityId, cityName, retries - 1);
        }
        console.error(`❌ Places error for ${cityName}`, err.message || err);
    }
};
