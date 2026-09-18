# Drones Dataset YOLO

- Source: <https://www.kaggle.com/datasets/monkeyboy999/drones-dataset-yolo>
- Kaggle owner: `monkeyboy999`
- License shown by Kaggle: CC BY 4.0
- Class: `0` (`drone`)
- Label format: YOLO detection (`class x_center y_center width height`), normalized to `0..1`

## Curated local copy

| Split | Images | Label files | Boxes | Empty labels |
| --- | ---: | ---: | ---: | ---: |
| train | 7,097 | 7,097 | 7,268 | 650 |
| val | 1,525 | 1,525 | 1,549 | 140 |
| test | 1,524 | 1,524 | 1,546 | 139 |
| Total | 10,146 | 10,146 | 10,363 | 929 |

The Kaggle archive contained 10,158 images and labels. Twelve byte-identical duplicate images were removed together with their duplicate labels. Two duplicate pairs crossed split boundaries; the evaluation copy was retained and the training or validation copy was removed. For duplicate pairs within `train`, the lexicographically first path was retained. See `removed_duplicates.txt` for the removed paths.

Validation performed before import:

- every retained image has a matching label file;
- every label row has five fields and class ID `0`;
- all normalized coordinates are within `0..1` and box sizes are positive;
- the 10,158 original JPEG files were readable;
- no retained image is byte-identical to an image in the repository's existing `images/` dataset.

Empty label files are intentional negative/background samples. Use `data.yaml` with Ultralytics YOLO from this directory.
