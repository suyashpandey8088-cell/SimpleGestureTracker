# ISL data feasibility — 2026-10-26

## Verified: ISLTranslate annotation inventory

Primary source: [Exploration-Lab/ISLTranslate](https://github.com/Exploration-Lab/ISLTranslate), README and `data/ISLTranslate.csv` inspected through the GitHub API. The CSV was analyzed outside this source repository; **no videos or dataset archives are committed**. Machine-readable results and the annotation SHA-256 are in `isltranslate-inventory.json`.

Observed, not extrapolated:

- 31,222 annotation rows with columns `uid,text`.
- 28,109 unique texts after trimming and case-folding; 3,113 repeated-text rows.
- No empty text rows.
- No signer, recording-session, split, frame-rate, resolution, video-duration, gloss, or gloss-timing columns in this CSV.
- The upstream README links [Exploration-Lab/iSign on Hugging Face](https://huggingface.co/datasets/Exploration-Lab/iSign) for video archives and pre-extracted holistic features. **These archives were not accessed or validated here:** sandbox outbound access does not include Hugging Face.
- The README states **CC BY-NC 4.0**, but calls the licensed data “CISLR” in that paragraph. GitHub's repository metadata does not expose a license file. Obtain explicit clarification of the exact release/license and permitted hosting/training uses before distribution. Do not treat the alphabet dataset's Apache license as applying to this dataset.
- Author-provided holistic features are not assumed compatible with our Tasks-based `isl-landmarks-v1`; a documented converter and model/runtime/coordinate parity check would be required.

This is an **annotation inventory, not a validated training manifest**. A signer-independent split cannot be invented from `uid`. Even if a prefix groups clips from a source video, it is not a reliable signer identity. Missing metadata must be supplied/verified. Repeat texts also require a distinct unseen-sentence evaluation split to test memorization versus generalization.

To reproduce the annotation inspection using authenticated `gh` (no data placed in Git):

```sh
gh api repos/Exploration-Lab/ISLTranslate/git/blobs/49b1cc47d8200f5942c6d5c6ccfb3b21ce8e016f --jq .content | base64 -d > /path/outside/repo/ISLTranslate.csv
```

## Other candidate datasets — not validated in this checkout

| Candidate | Potential use | What remains blocked/unverified |
| --- | --- | --- |
| ISL-CSLTR | Small continuous-sign prototype | Obtain the authoritative Mendeley release, license, actual video files, signer/session identities, translations, gloss fields and split policy. The counts in the proposed plan have **not** been independently confirmed here. |
| ISH-NEWS | Sentence-level research / annotations | Check the Scientific Reports paper and author resources; establish lawful source-video access. The research repository [NeverTheLess72/Sign-Language-Processing](https://github.com/NeverTheLess72/Sign-Language-Processing) contains extraction scripts and a word-presence task, not a verified ready-to-train translation release. No videos were fetched. No license clearance is inferred from publicly available scripts. |
| INCLUDE | Isolated-word pretraining | Verify the release, class count, sample counts, license and signer splits. Word labels alone do not supervise English sentence generation. |
| [ayesha-hannure/Indian-Sign-Language-dataset](https://github.com/ayesha-hannure/Indian-Sign-Language-dataset) | Separate alphabet module | Previously inspected alphabet image/CSV ZIPs are Git LFS assets, not continuous signing. They are not used to train this translation pipeline. |

No proposed counts from these unvalidated resources are promoted into the manifest. No restricted source video is scraped automatically.

## Data gate before training

1. Acquire the permitted videos and metadata outside Git. Document release ID, access date, attribution, license, consent/use restrictions and approval for the intended experiment.
2. Confirm video integrity, annotations, signer and recording/source IDs. Review caption/sign alignment with a proficient ISL signer. English captions are not automatically time-aligned gloss labels.
3. Extract each annotated utterance with `training.extract_landmarks`; retain raw media outside Git. Record model binaries/checksums and extraction environment in the release notes.
4. Make train/validation/test signer- and source-disjoint splits. Run `training.prepare_data`; it rejects missing provenance, broken features, duplicate IDs, identical feature files crossing splits, and signer/source leakage.
5. Also evaluate unseen sentences with `--unseen-sentences`; do not silently remove overlap from the test set after seeing model results. Pre-register the split selection policy.
6. Near-duplicates that are not byte-identical still require source grouping and human review. Automated exact hashing is **not** comprehensive duplicate-video detection.

**Milestone 1 status: BLOCKED** on videos, signer/source metadata, and release/license review. There is no validated train/validation/test manifest and no trained model in this repository.
