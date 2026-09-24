# MSc Thesis

This folder contains Mark Sroor's GUC master's thesis template and source files.

The first full draft focuses on personalised versus generic VR memory palaces.
It retains the proposal title and records outstanding study details in Appendix A.
Results are a provisional 22 September 2026 snapshot: the source workbook flags
six blocking errors and 130 unreviewed, uncounted responses. Do not treat the
draft results as a final approved analysis.

The pseudonymous numerical snapshot is in `data/results_snapshot_2026-09-22.json`.
Run `python verify_snapshot.py` to verify the recall summary arithmetic against
the included trial scores. This does not resolve source-data quality issues.

## Build

The entry point is `tex/thesis.tex`. From this directory, run:

```bash
./build.sh
```

The starter template uses pdfLaTeX and BibTeX. A TeX installation with
`latexmk` is required. Algorithm support is loaded automatically when
`algpseudocode` (algorithmicx) and `algorithm` (algorithms) are
installed; install those packages if you add algorithm environments.

The generated `thesis.pdf` is intentionally ignored by Git. Auxiliary files
can be removed with:

```bash
latexmk -C tex/thesis.tex
```

## Structure

- `tex/`: the main document, title pages, abstract, acknowledgments,
  chapters, and appendix
- `bibliography.bib`: bibliography database
- `images/`: figures and other thesis images

When editing with Codex, preserve the existing template structure, compile with
`./build.sh`, and inspect the resulting PDF for layout issues.
