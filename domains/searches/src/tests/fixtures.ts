import { createFixtureBuilder, createUserId } from "@flex/testing";
import { SearchTerm } from "@schemas/search";

export const userId = createUserId("test-searches-user");

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
const longSearchTerm = generateRandomString(101)
const searchTimestamp = Date.now().toLocaleString()

const longSearch: SearchTerm = { term: longSearchTerm, timestamp: searchTimestamp };
const validSearch1: SearchTerm = { term: "a search", timestamp: searchTimestamp };
const validSearch2: SearchTerm = { term: "a search", timestamp: searchTimestamp };

export const singleSearchList = [
    validSearch1,
]

const existingSearches = [
    validSearch1,
    validSearch2,
]

const emptySearch: SearchTerm[] = []

export const createLongSearch = createFixtureBuilder<SearchTerm>(longSearch);
export const createListOfSingleSearch = createFixtureBuilder<SearchTerm[]>(singleSearchList);
export const createListOfSearches = createFixtureBuilder<SearchTerm[]>(existingSearches);
export const createEmptySearch = createFixtureBuilder<SearchTerm[]>(emptySearch);
