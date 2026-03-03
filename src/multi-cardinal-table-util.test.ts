import { expect, test, describe } from 'vitest'
import { deduplicateTable, type MulticardinalRow } from './multi-cardinal-table-util';
import exampleData from "@/test-data/3x2-cartesian-product-example.json";


describe("deduplicateTable", () => {
  describe("3x2 cartesian product deduplication", () => {
    test("default", () => {
      const deduplicatedData = deduplicateTable(exampleData);
      const expectedResult: MulticardinalRow[] = [
        {
          subject: "http://data.nobelprize.org/resource/laureateaward/Chemistry/1901/160",
          props: {
            label: [
              "Nobelprisen i kjemi 1901, Jacobus H. van 't Hoff",
              "Nobelpriset i kemi 1901, Jacobus H. van 't Hoff",
              "The Nobel Prize in Chemistry 1901, Jacobus H. van 't Hoff",
            ],
            motivation: [
              "såsom ett erkännande av den utomordentliga förtjänst han inlagt genom upptäckten av lagarna för den kemiska dynamiken och för det osmotiska trycket i lösningar",
              "in recognition of the extraordinary services he has rendered by the discovery of the laws of chemical dynamics and osmotic pressure in solutions"
            ],
            year: [
              "1901",
            ],
            share: [
              "1",
            ],
          },
        },
        {
          subject: "http://data.nobelprize.org/resource/laureateaward/Chemistry/1902/161",
          props: {
            label: [
              "Nobelprisen i kjemi 1902, Emil Fischer",
              "Nobelpriset i kemi 1902, Emil Fischer",
              "The Nobel Prize in Chemistry 1902, Emil Fischer",
            ],
            motivation: [
              "in recognition of the extraordinary services he has rendered by his work on sugar and purine syntheses",
              "såsom ett erkännande av den utomordentliga förtjänst han inlagt genom sina syntetiska arbeten inom socker - och purin-grupperna",
            ],
            year: [
              "1902",
            ],
            share: [
              "1",
            ],
          }
        },
      ];

      expect(deduplicatedData).toStrictEqual(expectedResult);
    });

    test("by year", () => {
      const deduplicatedData = deduplicateTable(exampleData, "year");
      const expectedResult: MulticardinalRow[] = [
        {
          subject: "1901",
          props: {
            id: [
              "http://data.nobelprize.org/resource/laureateaward/Chemistry/1901/160"
            ],
            label: [
              "Nobelprisen i kjemi 1901, Jacobus H. van 't Hoff",
              "Nobelpriset i kemi 1901, Jacobus H. van 't Hoff",
              "The Nobel Prize in Chemistry 1901, Jacobus H. van 't Hoff",
            ],
            motivation: [
              "såsom ett erkännande av den utomordentliga förtjänst han inlagt genom upptäckten av lagarna för den kemiska dynamiken och för det osmotiska trycket i lösningar",
              "in recognition of the extraordinary services he has rendered by the discovery of the laws of chemical dynamics and osmotic pressure in solutions"
            ],
            share: [
              "1",
            ],
          },
        },
        {
          subject: "1902",
          props: {
            id: [
              "http://data.nobelprize.org/resource/laureateaward/Chemistry/1902/161",
            ],
            label: [
              "Nobelprisen i kjemi 1902, Emil Fischer",
              "Nobelpriset i kemi 1902, Emil Fischer",
              "The Nobel Prize in Chemistry 1902, Emil Fischer",
            ],
            motivation: [
              "in recognition of the extraordinary services he has rendered by his work on sugar and purine syntheses",
              "såsom ett erkännande av den utomordentliga förtjänst han inlagt genom sina syntetiska arbeten inom socker - och purin-grupperna",
            ],
            share: [
              "1",
            ],
          }
        },
      ];

      expect(deduplicatedData).toStrictEqual(expectedResult);
    });

    test("by index", () => {
      const stringKeyResult = deduplicateTable(exampleData, "year");
      const intKeyResult = deduplicateTable(exampleData, 3);

      expect(intKeyResult).toStrictEqual(stringKeyResult);
    });

    test("missing string key throws", () => {
      expect(() => {
        deduplicateTable(exampleData, "iDontExist");
      }).toThrow();
    });

    test("missing int key throws", () => {
      expect(() => {
        deduplicateTable(exampleData, 99);
      }).toThrow();
    });
  });
});
