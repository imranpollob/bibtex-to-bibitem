<div align="center">
  <img src="docs/logo.png" alt="BibTeX to Bibitem Logo" width="64" style="border-radius: 10px; margin-bottom: 8px;">
  <h1>BibTeX to Bibitem Converter</h1>
  <p>Convert BibTeX references into clean, IEEE-style LaTeX <code>\bibitem</code> entries instantly.</p>

  <p>
    <a href="https://imranpollob.github.io/BibTeX-to-Bibitem/"><img src="https://img.shields.io/badge/Live_App-Visit_Website-0d9488?style=flat-square" alt="Live Demo"></a>
    <a href="https://github.com/imranpollob/BibTeX-to-Bibitem/blob/master/LICENSE"><img src="https://img.shields.io/badge/License-MIT-0f766e?style=flat-square" alt="License"></a>
    <a href="https://github.com/imranpollob/personal-brand-theme"><img src="https://img.shields.io/badge/Design_Theme-Teal-14b8a6?style=flat-square" alt="Theme"></a>
  </p>
</div>

---

When preparing paper submissions for conferences (IEEE, ACM, Springer) or uploading source files to arXiv, publishers often require a self-contained LaTeX document with inline `\bibitem` entries instead of a separate `.bib` database.

Converting entries manually or fixing messy citation outputs is tedious. This tool automates the process with consistent, publication-ready formatting — available both as a web app and a Python CLI script.

---

## 🌐 Web App

Run it directly in your browser without installing anything:  
👉 **[imranpollob.github.io/BibTeX-to-Bibitem](https://imranpollob.github.io/BibTeX-to-Bibitem/)**

- **Instant conversion & live preview**: Paste text or drag-and-drop `.bib` files.
- **1-Click sample loaders**: Preloaded examples for articles, conference papers, and books.
- **Keyboard shortcuts**: <kbd>Ctrl/Cmd</kbd> + <kbd>Enter</kbd> to convert, <kbd>Ctrl/Cmd</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd> to copy.
- **Light & Dark mode**: Seamless theme switcher that remembers your preference.

---

## 💻 Python CLI

### Installation

```bash
git clone https://github.com/imranpollob/BibTeX-to-Bibitem.git
cd BibTeX-to-Bibitem
pip install -r requirements.txt
```

### Usage

Convert default `references.bib` to `bibitems.txt`:

```bash
python script.py
```

Or specify custom input and output paths:

```bash
python script.py --input my_references.bib --output my_bibitems.txt
```

---

## 📌 Example

**Input (`.bib`):**
```bibtex
@article{vaswani2017attention,
  author  = {Vaswani, Ashish and Shazeer, Noam and Parmar, Niki},
  title   = {Attention Is All You Need},
  journal = {Advances in Neural Information Processing Systems},
  volume  = {30},
  pages   = {5998--6008},
  year    = {2017},
  doi     = {10.5555/3295222.3295349}
}
```

**Output (`\bibitem`):**
```latex
\bibitem{vaswani2017attention}
A. Vaswani, N. Shazeer, and N. Parmar, ``Attention is all you need,'' \emph{Advances in Neural Information Processing Systems}, vol. 30, pp. 5998--6008, 2017, doi: 10.5555/3295222.3295349.
```

---

## 📄 Using in LaTeX

Paste the generated entries directly inside `thebibliography` at the end of your document:

```latex
\documentclass{article}
\usepackage{cite}
\usepackage{url}

\begin{document}

Here is a citation \cite{vaswani2017attention}.

\begin{thebibliography}{99}

\bibitem{vaswani2017attention}
A. Vaswani, N. Shazeer, and N. Parmar, ``Attention is all you need,'' \emph{Advances in Neural Information Processing Systems}, vol. 30, pp. 5998--6008, 2017, doi: 10.5555/3295222.3295349.

\end{thebibliography}

\end{document}
```

---

## 🔍 Supported Rules & Features

- **15+ Entry Types**: `@article`, `@inproceedings`, `@book`, `@incollection`, `@phdthesis`, `@mastersthesis`, `@techreport`, `@proceedings`, `@manual`, `@unpublished`, `@software`, `@dataset`, `@patent`, `@misc`, and `@online`.
- **Smart Author Parsing**: Initials + surname formatting, `Jr.` suffixes, `von` particles (`L. van Beethoven`), Oxford commas, and corporate authors (`{{Ethereum Foundation}}`).
- **Sentence Casing**: Preserves protected terms inside braces (`{AI}`, `{EVM}`) and mixed-case terms (`arXiv`).
- **Clean Identifiers**: Normalizes DOIs (`doi: 10.1109/...`) and formats online access dates.
- **Cross-Reference Support**: Resolves inherited fields from parent conference proceedings.

---

## 🧪 Tests

Run the 54-case regression test suite for both Python and JavaScript implementations:

```bash
# Python regression suite
python tests/test_converter.py
# or using pytest
pytest tests/

# JavaScript regression suite
node tests/test_js_converter.js
```

---

## 📝 License

Distributed under the [MIT License](LICENSE).
