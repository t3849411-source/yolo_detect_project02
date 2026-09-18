# Combined drone detection dataset

This training view combines:

- <https://www.kaggle.com/datasets/muki2003/yolo-drone-detection-dataset>
- <https://www.kaggle.com/datasets/monkeyboy999/drones-dataset-yolo>

Images are referenced through manifest files instead of being copied again. The first source's images are in `../../images/` and its restored YOLO labels are in `../../labels/`. The second source remains under `../monkeyboy999-drones-dataset-yolo/`.

## Curation and split policy

- Class IDs from both sources are normalized to `0: drone`.
- SHA-256 image hashes are used to find exact duplicates before splitting.
- The first source contained 20 duplicate copies, including 15 pairs crossing its original train/validation boundary. The evaluation copy was retained for cross-split pairs.
- The second source had already been curated from 10,158 to 10,146 unique images, including removal of two cross-split duplicate pairs.
- No byte-identical image was found between the two sources.
- Seed `42` assigns 10% of the first source's deduplicated training pool to validation.
- The first source's original validation images and the second source's original test images are reserved for testing.

| Split | Images | Boxes | Empty labels | muki2003 | monkeyboy999 |
| --- | ---: | ---: | ---: | ---: | ---: |
| train | 7,994 | 8,255 | 650 | 897 | 7,097 |
| val | 1,625 | 1,664 | 140 | 100 | 1,525 |
| test | 1,866 | 1,909 | 139 | 342 | 1,524 |
| Total | 11,485 | 11,828 | 929 | 1,339 | 10,146 |

`data.yaml` is the combined configuration. The source-specific test configurations are retained for checking domain performance. Detailed curation data is in `metadata.json`, and actual training/test results are in `training_summary.json`.
