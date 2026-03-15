import { expect, test, describe } from 'vitest'
import { deduplicateTable, type MulticardinalRow } from './multi-cardinal-table-util';
import exampleData from "@/test-data/3x2-cartesian-product-example.json";


describe("deduplicateTable", () => {
  describe("3x2 cartesian product deduplication", () => {
    test("by year", () => {
      const deduplicatedData = deduplicateTable(exampleData, ["year"]);
      const expectedResult: MulticardinalRow[] = [
        {
          idCols: ["year"],
          idValues: { year: "1901" },
          restCols: ["id", "label", "motivation", "share"],
          restValues: {
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
          idCols: ["year"],
          idValues: { year: "1902" },
          restCols: ["id", "label", "motivation", "share"],
          restValues: {
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

    test("by year and share", () => {
      const deduplicatedData = deduplicateTable(exampleData, ["year", "share"]);
      const idCols = ["year", "share"];
      const restCols = ["id", "label", "motivation"];
      const expectedResult: MulticardinalRow[] = [
        {
          idCols,
          idValues: { year: "1901", share: "1" },
          restCols,
          restValues: {
            id: [
              "http://data.nobelprize.org/resource/laureateaward/Chemistry/1901/160",
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
          },
        },
        {
          idCols,
          idValues: { year: "1902", share: "1" },
          restCols,
          restValues: {
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
          }
        },
      ];

      expect(deduplicatedData).toStrictEqual(expectedResult);
    });

    test("missing key throws", () => {
      expect(() => {
        deduplicateTable(exampleData, ["iDontExist"]);
      }).toThrow();
    });
  });
});
