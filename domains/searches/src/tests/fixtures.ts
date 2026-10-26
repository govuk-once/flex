import { createFixtureBuilder, createUserId } from "@flex/testing";
import {SelectedSearches, UpdatedSearches} from "@schemas/search";

export const userId = createUserId("test-searches-user");

const existingSearches = [
    { term: "term-1", timestamp: Date.now().toLocaleString() },
    { term: "term-2", timestamp: Date.now().toLocaleString() },
]

const baseSearches: UpdatedSearches = {
    searches: {
        existingSearches,
        newSearch: { term: "term-3", timestamp: Date.now().toLocaleString() }
    },
};

export const generateRandomString = (length: number):string => {

    const allCaps: string[] = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P", "Q","R","S","T","U","V","W","X", "Y","Z"]
    const allLower: string[] = allCaps.map(letter => letter.toLowerCase())
    const alphabet: string[] = [...allCaps, ...allLower]
    let output: string= ""

    for(let i = 0; i < length; i++){
        output += (alphabet[Math.floor(Math.random() * (alphabet.length + 1))])
    }

    return output
}
const longSearchTerm = generateRandomString(201)

const longSearches: UpdatedSearches = {
    searches: {
        existingSearches,
        newSearch: { term: longSearchTerm, timestamp: Date.now().toLocaleString() }
    },
};

export const createSearch = createFixtureBuilder<SelectedSearches>(baseSearches);
export const createLongSearch = createFixtureBuilder<SelectedSearches>(longSearches);

export const emptySearches = { searches: { existingSearches: [] } };
export const singleSearch = {
    searches: { existingSearches: [{  term: "term-1", timestamp: Date.now().toLocaleString() }] },
};
export const multipleSearch = {
    searches: { existingSearches },
};
