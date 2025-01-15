  // contentDetection.ts
  import { ContentType, DetectionScore } from '../types';
  
  function isMarkdownFormatting(content: string): boolean {
    const lines = content.split('\n');
    let markdownCount = 0;
    let totalLines = 0;
  
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      totalLines++;
  
      if (
        /^\d+\.\s/.test(trimmedLine) || // Numbered list
        /^\*\s/.test(trimmedLine) || // Bullet point
        /^\s+\*\s/.test(trimmedLine) || // Nested bullet point
        /^#+\s/.test(trimmedLine) || // Headers
        /^\s*[-+]\s/.test(trimmedLine) // Alternative bullet points
      ) {
        markdownCount++;
      }
    }
  
    return totalLines > 0 && (markdownCount / totalLines) > 0.3;
  }
  
  function hasCodeStructure(content: string): boolean {
    const lines = content.split('\n');
    let structureScore = 0;
    
    // Check for consistent indentation
    const indentPattern = lines.some((line, i) => {
      if (i === 0 || !line.trim()) return false;
      return /^(?:\t|  +)/.test(line);
    });
    if (indentPattern) structureScore += 1;
    
    // Check for balanced braces
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    if (openBraces > 0 && openBraces === closeBraces) structureScore += 1;
    
    // Check for code-specific punctuation
    if (
      lines.some(line => /;\s*$/.test(line.trim())) || // Semicolons at line end
      /=>\s*{/.test(content) || // Arrow functions
      /\(\s*\)\s*{/.test(content) // Function declarations
    ) {
      structureScore += 1;
    }
    
    return structureScore >= 2;
  }
  
  function hasCodeIndicators(content: string): boolean {
    const codePatterns = [
      /\b(function|class|const|let|var)\b.*[{;]/, // Declarations
      /\b(return|if|for|while)\b.*[{;]/, // Control structures
      /^(import|export)\b.*[;{]/, // Module syntax
      /=>\s*{/, // Arrow functions
      /\b(public|private|protected)\b/, // Access modifiers
      /\b\w+\s*\([^)]*\)\s*{/, // Function definitions
      /\bcatch\s*\([^)]*\)\s*{/, // Try-catch blocks
      /\binterface\s+\w+\s*{/, // TypeScript interfaces
      /\bextends\s+\w+(\s*,\s*\w+)*\s*{/, // Class inheritance
      /\bimplements\s+\w+(\s*,\s*\w+)*\s*{/ // Interface implementation
    ];
  
    return codePatterns.filter(pattern => pattern.test(content)).length >= 2;
  }
  
  function isKeywordList(content: string): boolean {
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
    const keywordPattern = /^[A-Z][A-Z\s]*$/;
    const keywordLines = lines.filter(line => keywordPattern.test(line));
    return lines.length > 0 && (keywordLines.length / lines.length) > 0.5;
  }
  
  function isMathContent(content: string): boolean {
    const mathPatterns = [
      /[\u2200-\u22FF]/, // Mathematical operators
      /[∀∂∃∅∈∉∋∌∏∑−∕∗∘∙√∝∞∟∠∡∢∣]/, // Math symbols
      /\b\d+[\+\-\*\/\^]\d+\b/, // Basic operations
      /\([^)]+\)/, // Parentheses grouping
      /\b(?:sin|cos|tan|log|ln|lim|inf|sup)\b/, // Math functions
      /[α-ωΑ-Ω]/, // Greek letters
      /\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/, // Scientific notation
      /[≠≈≤≥±×÷]/, // Additional math operators
      /\b(?:sup|inf|max|min|arg|ker|dim)\b/, // More math functions
      /_{[^}]+}|\^{[^}]+}/ // Subscripts and superscripts
    ];
    
    return mathPatterns.filter(pattern => pattern.test(content)).length >= 2;
  }
  
  function detectLanguageSpecific(content: string): DetectionScore[] {
    const scores: DetectionScore[] = [];
    
    // CSS Detection
    const cssScore = ((): number => {
      if (!content.includes('{')) return 0;
      let score = 0;
      if (/[.#]?[a-zA-Z][a-zA-Z0-9-_]*\s*{/.test(content)) score += 2;
      if (/[a-zA-Z-]+\s*:\s*[^;]+;/.test(content)) score += 2;
      if (/@media\s*[^{]+{/.test(content)) score += 1;
      if (/@(keyframes|import|charset|font-face)/.test(content)) score += 1;
      if (/!(important|default)/.test(content)) score += 1;
      return score;
    })();
    if (cssScore > 0) scores.push({ type: ContentType.CSS, score: cssScore });
  
    // HTML Detection
    const htmlScore = ((): number => {
      let score = 0;
      if (/<[^>]+>/.test(content)) score += 2;
      if (/<\/[^>]+>/.test(content)) score += 2;
      if (/<!DOCTYPE\s+html>/i.test(content)) score += 3;
      if (/\s(class|id|style|href|src)=["'][^"']*["']/.test(content)) score += 2;
      return score;
    })();
    if (htmlScore > 0) scores.push({ type: ContentType.HTML, score: htmlScore });
  
    // Python Detection
    const pythonScore = ((): number => {
      let score = 0;
      if (/\b(def|class)\s+\w+\s*[\(\:]/.test(content)) score += 2;
      if (/\bimport\s+[\w.]+\b/.test(content)) score += 1;
      if (/\bfrom\s+[\w.]+\s+import\b/.test(content)) score += 2;
      if (/^\s*@\w+/.test(content)) score += 2; // Decorators
      if (/\bself\.\w+/.test(content)) score += 1;
      if (/:\s*$/.test(content)) score += 1;
      return score;
    })();
    if (pythonScore > 0) scores.push({ type: ContentType.PYTHON, score: pythonScore });
  
    // SQL Detection
    const sqlScore = ((): number => {
      let score = 0;
      if (/\b(SELECT|INSERT|UPDATE|DELETE)\b/i.test(content)) score += 2;
      if (/\b(FROM|WHERE|JOIN|GROUP BY|ORDER BY)\b/i.test(content)) score += 2;
      if (/\b(CREATE|ALTER|DROP|TRUNCATE)\s+TABLE\b/i.test(content)) score += 3;
      if (/\b(INT|VARCHAR|TEXT|DATE|BOOLEAN)\b/i.test(content)) score += 1;
      return score;
    })();
    if (sqlScore > 0) scores.push({ type: ContentType.SQL, score: sqlScore });
  
    // Shell Script Detection
    const shellScore = ((): number => {
      let score = 0;
      if (/^#!.*\b(bash|sh|zsh)\b/.test(content)) score += 3;
      if (/\b(sudo|apt|yum|brew|npm|yarn|pip)\b/.test(content)) score += 1;
      if (/\$\{[^}]+\}/.test(content)) score += 2;
      if (/\b(chmod|chown|mkdir|rm|cp|mv|ls)\b/.test(content)) score += 1;
      if (/\|\s*\w+/.test(content)) score += 1; // Pipes
      return score;
    })();
    if (shellScore > 0) scores.push({ type: ContentType.SHELL, score: shellScore });
  
    return scores;
  }
  
  function detectContentTypeImpl(content: string): ContentType {
    try {
      const trimmedContent = content.trim();
      
      // Early returns
      if (!trimmedContent) return ContentType.TEXT;
      if (trimmedContent.length < 10) return ContentType.TEXT;
      
      // Check for URLs
      try {
        new URL(trimmedContent);
        return ContentType.URL;
      } catch {}
    
      // Check for JSON
      try {
        JSON.parse(trimmedContent);
        return ContentType.JSON;
      } catch {}
    
      // Check for markdown-style formatting
      if (isMarkdownFormatting(trimmedContent)) {
        return ContentType.TEXT;
      }
    
      // Check for keyword lists
      if (isKeywordList(trimmedContent)) {
        return ContentType.TEXT;
      }
    
      // Check for math content
      if (isMathContent(trimmedContent)) {
        return ContentType.MATH;
      }
    
      // Initialize scores array
      let scores: DetectionScore[] = [];
    
      // Get language-specific scores
      scores = scores.concat(detectLanguageSpecific(content));
    
      // Add code structure score
      if (hasCodeStructure(content) && hasCodeIndicators(content)) {
        scores.push({ type: ContentType.CODE, score: 3 });
      }
    
      // Get highest scoring type
      const highestScore = scores.reduce(
        (max, curr) => curr.score > max.score ? curr : max,
        { type: ContentType.TEXT, score: 0 }
      );
    
      // Require a minimum score to classify as something other than TEXT
      return highestScore.score >= 2 ? highestScore.type : ContentType.TEXT;
    } catch (error) {
      console.error('Content detection error:', error);
      return ContentType.TEXT; // Safe fallback
    }
  }
  
  // Add memoization for frequent patterns
  const memoizedResults = new Map<string, ContentType>();
  const MEMO_MAX_SIZE = 1000;
  
  export function detectContentType(content: string): ContentType {
    // Use hash or first N chars as key
    const key = content.slice(0, 100);
    
    if (memoizedResults.has(key)) {
      return memoizedResults.get(key)!;
    }
  
    const result = detectContentTypeImpl(content);
    
    if (memoizedResults.size >= MEMO_MAX_SIZE) {
      memoizedResults.clear();
    }
    memoizedResults.set(key, result);
  
    return result;
  }
  
  export function normalizeContent(content: string, type: ContentType): string {
    if (type === ContentType.TEXT) {
      return content
        .split('\n')
        .map(line => {
          const indent = line.match(/^\s*/)?.[0] || '';
          return indent + line.trim();
        })
        .join('\n');
    }
    return content;
  }
  
  export function getSyntaxHighlightClass(type: ContentType): string {
    const classMap: Record<ContentType, string> = {
      [ContentType.CODE]: 'language-javascript',
      [ContentType.HTML]: 'language-html',
      [ContentType.CSS]: 'language-css',
      [ContentType.PYTHON]: 'language-python',
      [ContentType.SQL]: 'language-sql',
      [ContentType.JSON]: 'language-json',
      [ContentType.XML]: 'language-xml',
      [ContentType.MARKDOWN]: 'language-markdown',
      [ContentType.SHELL]: 'language-shell',
      [ContentType.MATH]: 'language-math',
      [ContentType.URL]: 'language-url',
      [ContentType.TEXT]: ''
    };
    
    return classMap[type] || '';
  }