import { parseBibTeX, convertToBibitem, getWarnings } from './converter.js';

const SAMPLES = {
  article: `@article{vaswani2017attention,
  author  = {Vaswani, Ashish and Shazeer, Noam and Parmar, Niki and Uszkoreit, Jakob and Jones, Llion and Gomez, Aidan N. and Kaiser, {\\L}ukasz and Polosukhin, Illia},
  title   = {Attention Is All You Need},
  journal = {Advances in Neural Information Processing Systems},
  volume  = {30},
  pages   = {5998--6008},
  year    = {2017},
  doi     = {10.5555/3295222.3295349}
}`,

  conference: `@inproceedings{lee2024detecting,
  author    = {Michael Lee and Robert Jones and Sarah Ahmed},
  title     = {Detecting Vulnerabilities in Smart Contracts},
  booktitle = {Proceedings of the IEEE Symposium on Security and Privacy},
  pages     = {120--134},
  month     = may,
  year      = {2024},
  address   = {San Francisco, CA, USA},
  doi       = {10.1109/SP.2024.1234567}
}`,

  book: `@book{goodfellow2016deep,
  author    = {Goodfellow, Ian and Bengio, Yoshua and Courville, Aaron},
  title     = {Deep Learning},
  edition   = {1},
  publisher = {MIT Press},
  address   = {Cambridge, MA, USA},
  year      = {2016}
}`,

  suite: `@article{t01_basic_article,
  author  = {John Smith and Alice Brown},
  title   = {Security Analysis of Blockchain Systems},
  journal = {IEEE Transactions on Dependable and Secure Computing},
  volume  = {22},
  number  = {3},
  pages   = {421--435},
  year    = {2025}
}

@inproceedings{t02_conference,
  author    = {Michael Lee and Robert Jones and Sarah Ahmed},
  title     = {Detecting Vulnerabilities in Smart Contracts},
  booktitle = {Proceedings of the IEEE Symposium on Security and Privacy},
  pages     = {120--134},
  year      = {2024}
}

@book{t05_book,
  author    = {William Stallings},
  title     = {Cryptography and Network Security},
  edition   = {7th},
  publisher = {Pearson},
  address   = {Boston, MA, USA},
  year      = {2017}
}

@phdthesis{t08_phd,
  author  = {Jane Doe},
  title   = {Security and Privacy in Decentralized Systems},
  school  = {Wayne State University},
  address = {Detroit, MI, USA},
  year    = {2024}
}

@misc{t11_misc_url,
  author       = {{Ethereum Foundation}},
  title        = {{ERC-4337}: Account Abstraction Using Alt Mempool},
  howpublished = {\\url{https://eips.ethereum.org/EIPS/eip-4337}},
  year         = {2023},
  note         = {Accessed: Sep. 15, 2026}
}

@misc{t14_arxiv_misc,
  author        = {Li Wang and Peter Smith},
  title         = {Security Analysis of Programmable Accounts},
  year          = {2026},
  eprint        = {2604.01234},
  archivePrefix = {arXiv},
  primaryClass  = {cs.CR}
}`
};

if (typeof document !== 'undefined') {
  // DOM Elements
  const bibtexInput = document.getElementById('bibtex-input');
  const bibitemOutput = document.getElementById('bibitem-output');
  const inputInfo = document.getElementById('input-info');
  const outputInfo = document.getElementById('output-info');
  const inputBadge = document.getElementById('input-badge');
  const outputBadge = document.getElementById('output-badge');
  const metricsTime = document.getElementById('metrics-time');
  const fileUpload = document.getElementById('file-upload');
  const convertBtn = document.getElementById('convert-btn');
  const clearInputBtn = document.getElementById('clear-input');
  const copyBtn = document.getElementById('copy-btn');
  const downloadBtn = document.getElementById('download-btn');
  const themeToggle = document.getElementById('theme-toggle');
  const dropZone = document.getElementById('drop-zone');
  const copyLatexBtn = document.getElementById('copy-latex-template');
  const latexTemplateCode = document.getElementById('latex-template-code');

  // Theme Toggler
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      try { localStorage.setItem('theme', newTheme); } catch {}
      showToast(`Switched to ${newTheme} mode`, 'info');
    });
  }

  // OS theme change listener
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    let savedTheme;
    try { savedTheme = localStorage.getItem('theme'); } catch {}
    if (!savedTheme) {
      const newTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  });

  // Sample Loaders
  document.querySelectorAll('.btn-sample').forEach(btn => {
    btn.addEventListener('click', () => {
      const sampleKey = btn.getAttribute('data-sample');
      if (SAMPLES[sampleKey] && bibtexInput) {
        bibtexInput.value = SAMPLES[sampleKey];
        handleConvert();
        showToast(`Loaded ${sampleKey} sample!`, 'success');
      }
    });
  });

  // Copy LaTeX Template button
  if (copyLatexBtn && latexTemplateCode) {
    copyLatexBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(latexTemplateCode.textContent);
        showToast('LaTeX template copied to clipboard!', 'success');
      } catch {
        showToast('Failed to copy template', 'error');
      }
    });
  }

  // File drag & drop listeners
  function readFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (bibtexInput) {
        bibtexInput.value = e.target.result;
        handleConvert();
        showToast(`Loaded ${file.name}!`, 'success');
      }
    };
    reader.onerror = () => showToast('Could not read the selected file', 'error');
    reader.readAsText(file);
    if (fileUpload) fileUpload.value = '';
  }

  if (dropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt && dt.files;
      if (files && files.length > 0) {
        readFile(files[0]);
      }
    }, false);
  }

  // File upload input listener
  if (fileUpload) {
    fileUpload.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        readFile(file);
      }
    });
  }

  // Input changes & debounce auto-convert
  let convertTimeout;
  if (bibtexInput) {
    bibtexInput.addEventListener('input', () => {
      const text = bibtexInput.value.trim();
      bibitemOutput.value = '';
      copyBtn.disabled = true;
      downloadBtn.disabled = true;
      outputBadge.textContent = '0 converted';
      outputInfo.textContent = text ? 'Waiting for conversion…' : 'Waiting for input';
      renderWarnings([]);
      if (convertBtn) convertBtn.disabled = !text;

      const count = (text.match(/@(?!string\b|comment\b|preamble\b)[\w-]+\s*[{(]/gi) || []).length;
      if (inputBadge) inputBadge.textContent = `${count} ${count === 1 ? 'entry' : 'entries'}`;

      clearTimeout(convertTimeout);
      convertTimeout = setTimeout(() => {
        if (text) {
          handleConvert();
        } else {
          handleClear();
        }
      }, 400);
    });
  }

  function renderWarnings(warnings) {
    const list = document.getElementById('conversion-warnings');
    list.replaceChildren(...warnings.map(message => {
      const item = document.createElement('li'); item.textContent = message; return item;
    }));
  }

  function handleClear() {
    clearTimeout(convertTimeout);
    renderWarnings([]);
    if (bibtexInput) bibtexInput.value = '';
    if (bibitemOutput) bibitemOutput.value = '';
    if (inputInfo) {
      inputInfo.textContent = 'Ready for input';
      inputInfo.className = 'entry-info';
    }
    if (outputInfo) {
      outputInfo.textContent = 'Waiting for conversion';
      outputInfo.className = 'entry-info';
    }
    if (inputBadge) inputBadge.textContent = '0 entries';
    if (outputBadge) outputBadge.textContent = '0 converted';
    if (metricsTime) metricsTime.textContent = '0 ms';
    if (copyBtn) copyBtn.disabled = true;
    if (downloadBtn) downloadBtn.disabled = true;
    if (convertBtn) convertBtn.disabled = true;
  }

  function handleConvert() {
    if (!bibtexInput) return;
    const bibtexText = bibtexInput.value.trim();

    if (!bibtexText) {
      handleClear();
      return;
    }

    clearTimeout(convertTimeout);
    renderWarnings([]);
    if (convertBtn) convertBtn.disabled = false;
    const startTime = performance.now();
    try {
      const entries = parseBibTeX(bibtexText);
      const inputCount = entries.length;
      if (inputBadge) inputBadge.textContent = `${inputCount} ${inputCount === 1 ? 'entry' : 'entries'}`;
      if (inputInfo) {
        inputInfo.textContent = `Detected ${inputCount} BibTeX ${inputCount === 1 ? 'entry' : 'entries'}`;
        inputInfo.className = 'entry-info';
      }

      const warnings = getWarnings(entries);
      renderWarnings(warnings);
      const bibitems = convertToBibitem(entries);
      const elapsed = Math.round(performance.now() - startTime);
      if (metricsTime) metricsTime.textContent = `${elapsed} ms`;

      if (bibitems.length === 0) {
        if (outputInfo) {
          outputInfo.textContent = `0 entries converted (${inputCount} failed or skipped)`;
          outputInfo.className = 'entry-info error';
        }
        if (outputBadge) outputBadge.textContent = '0 converted';
        if (bibitemOutput) bibitemOutput.value = '';
        if (copyBtn) copyBtn.disabled = true;
        if (downloadBtn) downloadBtn.disabled = true;
        return;
      }

      if (bibitemOutput) bibitemOutput.value = bibitems.join('\n\n');
      if (outputBadge) outputBadge.textContent = `${bibitems.length} converted`;
      if (copyBtn) copyBtn.disabled = false;
      if (downloadBtn) downloadBtn.disabled = false;

      const skipped = warnings.length;
      if (outputInfo) {
        if (skipped > 0) {
          outputInfo.textContent = `Converted ${bibitems.length} ${bibitems.length === 1 ? 'entry' : 'entries'} (${skipped} metadata warnings; review below) in ${elapsed} ms`;
          outputInfo.className = 'entry-info warning';
        } else {
          outputInfo.textContent = `Successfully converted ${bibitems.length} ${bibitems.length === 1 ? 'entry' : 'entries'} in ${elapsed} ms`;
          outputInfo.className = 'entry-info success';
        }
      }
    } catch (error) {
      if (outputBadge) outputBadge.textContent = '0 converted';
      if (metricsTime) metricsTime.textContent = '0 ms';
      if (outputInfo) {
        outputInfo.textContent = `Error: ${error.message}`;
        outputInfo.className = 'entry-info error';
      }
      if (bibitemOutput) bibitemOutput.value = '';
      if (copyBtn) copyBtn.disabled = true;
      if (downloadBtn) downloadBtn.disabled = true;
    }
  }

  async function handleCopy() {
    if (!bibitemOutput) return;
    const text = bibitemOutput.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied all bibitems to clipboard!', 'success');
    } catch {
      bibitemOutput.select();
      const copied = document.execCommand('copy');
      showToast(copied ? 'Copied all bibitems to clipboard!' : 'Copy unavailable; select and copy the output manually.', copied ? 'success' : 'error');
    }
  }

  function handleDownload() {
    if (!bibitemOutput) return;
    const text = bibitemOutput.value;
    if (!text) return;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'bibitems.tex';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded bibitems.tex!', 'success');
  }

  // Toast Notification System
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  // Button actions
  if (convertBtn) convertBtn.addEventListener('click', handleConvert);
  if (clearInputBtn) clearInputBtn.addEventListener('click', handleClear);
  if (copyBtn) copyBtn.addEventListener('click', handleCopy);
  if (downloadBtn) downloadBtn.addEventListener('click', handleDownload);

  // Keyboard Shortcuts (Cmd/Ctrl+Enter -> Convert, Cmd/Ctrl+Shift+C -> Copy)
  window.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (modifier && e.key === 'Enter') {
      e.preventDefault();
      if (convertBtn && !convertBtn.disabled) handleConvert();
    } else if (modifier && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
      e.preventDefault();
      if (copyBtn && !copyBtn.disabled) handleCopy();
    }
  });
}

