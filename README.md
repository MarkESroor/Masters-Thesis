# MSc Thesis

This folder contains Mark Sroor's GUC master's thesis template and source files.

## Build

The entry point is `thesis.tex`. From this directory, run:

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
latexmk -C thesis.tex
```

## Structure

- `thesis.tex`: main document and chapter order
- `GUC_TitlePage.tex`: GUC title and declaration pages
- `introduction.tex`, `background.tex`, `methodology.tex`,
  `implementation.tex`, `results.tex`, and `conclusion.tex`: chapter files
- `bibliography.bib`: bibliography database
- `images/`: figures and other thesis images

When editing with Codex, preserve the existing template structure, compile with
`./build.sh`, and inspect the resulting PDF for layout issues.
