function readActiveCustomPrompt() {
  try {
    const raw = localStorage.getItem('customPrompts');
    const prompts = raw ? JSON.parse(raw) : [];
    const activeId = localStorage.getItem('activePromptId');
    if (Array.isArray(prompts) && prompts.length > 0 && activeId) {
      const active = prompts.find(p => p.id === activeId);
      return String(active?.content || '');
    }
  } catch (_) {}
  return String(localStorage.getItem('customPrompt') || '');
}

function hasGlobalStructureRules(promptText) {
  const t = String(promptText || '').toLowerCase();
  if (!t) return false;
  return (
    t.includes('global answer structure') ||
    t.includes('every answer must explicitly start with') ||
    t.includes('question: question restatement')
  );
}

function startsWithQuestionLine(text) {
  const s = String(text || '').trimStart();
  return /^question\s*:/i.test(s);
}

function isLikelyCodeLine(line) {
  const l = line.trim();
  if (!l) return false;
  if (l.startsWith('//')) return true;
  if (/^[A-Za-z_][A-Za-z0-9_]*\s*\(.*\)\s*\{?$/.test(l)) return true;
  if (/^\s*(const|let|var|function|class|import|export)\b/.test(l)) return true;
  if (/=>\s*\{?$/.test(l)) return true;
  if (/^\s*\{|\}\s*$/.test(l)) return true;
  if (/^\s*console\.log\(.+\)\s*;?$/.test(l)) return true;
  if (l.includes(';') && l.length < 200 && /[();{}]/.test(l)) return true;
  if (/^<\w+/.test(l)) return true;
  return false;
}

function wrapDetectedCodeBlocks(lines, defaultLang) {
  const out = [];
  let inFence = false;
  let fenceLang = '';
  let inDetected = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) {
      if (!inFence) {
        inFence = true;
        fenceLang = trimmed.replace(/^```+/, '').trim() || '';
        out.push(line);
      } else {
        inFence = false;
        fenceLang = '';
        out.push(line);
      }
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    if (!inDetected && isLikelyCodeLine(line)) {
      inDetected = true;
      out.push('```' + (defaultLang || ''));
      out.push(line);
      continue;
    }
    if (inDetected) {
      if (isLikelyCodeLine(line) || line.trim() === '' || /^\s*\/\/.+/.test(line)) {
        out.push(line);
        continue;
      } else {
        out.push('```');
        inDetected = false;
        out.push(line);
        continue;
      }
    }
    out.push(line);
  }
  if (inDetected) out.push('```');
  return out;
}

function ensureLabelsStyling(text) {
  const lines = String(text || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*Main Point\s*[-–]\s*/i.test(l)) {
      lines[i] = l.replace(/^(\s*)Main Point(\s*[-–]\s*)/i, '$1**Main Point**$2');
    } else if (/^\s*Supporting Explanation\s*[-–]\s*/i.test(l)) {
      lines[i] = l.replace(/^(\s*)Supporting Explanation(\s*[-–]\s*)/i, '$1**Supporting Explanation**$2');
    } else if (/^\s*Example\s*or\s*Code\s*[-–]\s*/i.test(l)) {
      lines[i] = l.replace(/^(\s*)Example\s*or\s*Code(\s*[-–]\s*)/i, '$1**Example or Code**$2');
    } else if (/^\s*End Line\s*[-–]\s*/i.test(l)) {
      lines[i] = l.replace(/^(\s*)End Line(\s*[-–]\s*)/i, '$1**End Line**$2');
    } else if (/^\s*Step\s*1\s*[-–]\s*/i.test(l)) {
      lines[i] = l.replace(/^(\s*)Step\s*1(\s*[-–]\s*)/i, '$1**Step 1**$2');
    } else if (/^\s*Step\s*2\s*[-–]\s*/i.test(l)) {
      lines[i] = l.replace(/^(\s*)Step\s*2(\s*[-–]\s*)/i, '$1**Step 2**$2');
    } else if (/^\s*Step\s*3\s*[-–]\s*/i.test(l)) {
      lines[i] = l.replace(/^(\s*)Step\s*3(\s*[-–]\s*)/i, '$1**Step 3**$2');
    } else if (/^\s*Step\s*4\s*[-–]\s*/i.test(l)) {
      lines[i] = l.replace(/^(\s*)Step\s*4(\s*[-–]\s*)/i, '$1**Step 4**$2');
    }
  }
  return lines.join('\n');
}

function detectDefaultLanguage(promptText) {
  const t = String(promptText || '').toLowerCase();
  if (t.includes('react')) return 'jsx';
  if (t.includes('javascript') || t.includes('node.js')) return 'javascript';
  if (t.includes('typescript')) return 'typescript';
  if (t.includes('python')) return 'python';
  return '';
}

function formatAnswer(rawText, question, promptText) {
  const q = String(question || '').trim();
  const p = String(promptText || readActiveCustomPrompt());
  const useGlobal = hasGlobalStructureRules(p);
  let text = String(rawText || '');
  if (useGlobal && q && !startsWithQuestionLine(text)) {
    const header = `Question: ${q}\n\n`;
    text = header + text;
  }
  text = ensureLabelsStyling(text);
  const defaultLang = detectDefaultLanguage(p);
  const lines = text.split('\n');
  const wrapped = wrapDetectedCodeBlocks(lines, defaultLang);
  return wrapped.join('\n');
}

export { formatAnswer, readActiveCustomPrompt };
