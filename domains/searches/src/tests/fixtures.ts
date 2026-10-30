import { createFixtureBuilder, createUserId } from "@flex/testing";
import { SearchTerm, SelectedSearches, UserSearches} from "@schemas/search";

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

const singleSearchList: SelectedSearches = {
    searches: {
        selectedSearches: [
            { term: "a search 1", timestamp: searchTimestamp },
       ],
    },
};

const baseSearches: SelectedSearches = {
    searches: {
        selectedSearches: [
            { term: "a search 1", timestamp: searchTimestamp },
            { term: "a search 2", timestamp: searchTimestamp },
        ],
    },
};

const emptySearch: SearchTerm[] = []

export const createLongSearch = createFixtureBuilder<SearchTerm>(longSearch);
export const createListOfSingleSearch = createFixtureBuilder<SelectedSearches>(singleSearchList);
export const createListOfSearches = createFixtureBuilder<SelectedSearches>(baseSearches);
export const createEmptySearch = createFixtureBuilder<SearchTerm[]>(emptySearch);
