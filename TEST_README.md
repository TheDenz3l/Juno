# ML-Powered ATS Keyword Extraction - Test Suite

## Overview

This test suite validates the ML-powered keyword extraction system using the BAAI/bge-small-en-v1.5 embedding model.

## Test Data

- **Job Posting**: `test-data/job-posting.json` - Sales Associate position for luxury retail
- **Resumes**:
  - `test-data/resume-excellent-match.json` - 4+ years experience, Salesforce, bilingual
  - `test-data/resume-good-match.json` - 2.5 years experience, basic skills
  - `test-data/resume-poor-match.json` - Limited experience, no retail background

## Running Tests

### 1. Baseline Rule-Based Test (Node.js)

```bash
node test-ats-extraction.js
```

**What it tests:**
- Rule-based keyword extraction (current system)
- Keyword quality analysis
- Resume matching with baseline approach
- Generates baseline metrics for comparison

**Results**: `test-data/test-results-rule-based.json`

### 2. ML Extraction Test (Chrome Extension)

1. Load the extension in Chrome:
   ```bash
   # Build the extension
   npm run build

   # Load unpacked extension from dist/ directory in Chrome
   # chrome://extensions → Enable "Developer mode" → "Load unpacked" → select dist/
   ```

2. Open the test page:
   ```
   Open: chrome-extension://<your-extension-id>/test-ml-extraction.html
   ```

   Or copy `test-ml-extraction.html` to the `dist/` folder after building:
   ```bash
   cp test-ml-extraction.html dist/
   # Then open: chrome://extensions → Juno → test-ml-extraction.html
   ```

3. Run tests by clicking buttons:
   - **Test ML Extraction** - Extract keywords using BGE model
   - **Compare ML vs Rules** - Side-by-side comparison
   - **Test Full Pipeline** - Complete ATS scoring flow

## Test Results - Baseline (Rule-Based)

### Rule-Based Extraction Performance

```
Total Keywords: 79
Quality Score: 34.2% (relevant keywords)

Issues Detected:
❌ Extracted multi-line blocks instead of individual keywords
❌ Captured boilerplate text ("About Us", "We partner with")
❌ Low precision - many irrelevant terms
```

### Resume Matching Scores (Rule-Based)

| Resume Quality | ATS Score | Match Rate |
|----------------|-----------|------------|
| Excellent      | 29/100    | 19.0%      |
| Good           | 10/100    | 7.6%       |
| Poor           | 4/100     | 3.8%       |

**Problems:**
- Even excellent resumes score poorly (29/100)
- No semantic understanding (e.g., "customer service" ≠ "client relations")
- Keyword extraction is too literal

## Expected ML Improvements

### Semantic Understanding
- ✅ Recognize synonyms (JavaScript ↔ JS, CRM ↔ Salesforce)
- ✅ Understand related concepts (leadership ↔ team management)
- ✅ Context-aware extraction (focus on requirements, not fluff)

### Quality Improvements
- ✅ Filter out boilerplate and marketing language
- ✅ Extract clean, individual keywords (not multi-line blocks)
- ✅ Higher precision (only relevant skills/requirements)

### Expected Score Improvements
| Resume Quality | Rule-Based | ML-Powered (Expected) | Improvement |
|----------------|------------|----------------------|-------------|
| Excellent      | 29/100     | 75-85/100           | +46-56 pts  |
| Good           | 10/100     | 55-65/100           | +45-55 pts  |
| Poor           | 4/100      | 25-35/100           | +21-31 pts  |

## Test Metrics to Validate

### 1. Keyword Quality
- [ ] Fewer than 50 keywords extracted (more focused)
- [ ] Quality score > 80% (high precision)
- [ ] No multi-line blocks or boilerplate
- [ ] Clear hard/soft skill categorization

### 2. Semantic Understanding
- [ ] Recognizes "Salesforce" and "CRM" as related
- [ ] Matches "customer service" with "client relations"
- [ ] Identifies "leadership" from experience descriptions

### 3. ATS Score Accuracy
- [ ] Excellent resume scores 75+ (vs 29 baseline)
- [ ] Good resume scores 55+ (vs 10 baseline)
- [ ] Poor resume scores 25+ (vs 4 baseline)
- [ ] Proper differentiation between match levels

### 4. Performance
- [ ] Keyword extraction < 5 seconds
- [ ] Model loads in < 30 seconds
- [ ] No UI blocking during inference

## Manual Validation Checklist

When testing in the extension:

1. **Load Extension**
   - [ ] Extension loads without errors
   - [ ] Model files are accessible
   - [ ] Web Worker initializes successfully

2. **Navigate to Job Posting**
   - [ ] Open Indeed job posting
   - [ ] Job details are extracted correctly
   - [ ] ML extraction starts automatically

3. **Upload Resume**
   - [ ] Upload test resume
   - [ ] ATS calculation triggers
   - [ ] Loading state is visible

4. **Review Results**
   - [ ] ATS score is reasonable (75-85 for excellent match)
   - [ ] Matched keywords are relevant
   - [ ] Missing keywords make sense
   - [ ] No fluff in keyword lists

5. **Check Console Logs**
   ```
   [ATS Matcher] Attempting ML-based keyword extraction...
   [Embedding Worker] Loading BGE model...
   [Embedding Worker] Model loaded successfully!
   [Embedding Worker] Generating job description embedding...
   [Embedding Worker] Found X keyword candidates
   [ATS Matcher] ML extraction successful: Y keywords found
   [ATS Matcher] Combined ML + rules: Z total keywords
   ```

6. **Error Handling**
   - [ ] Test with ML disabled (should fallback to rules)
   - [ ] Test with invalid job description
   - [ ] Verify error messages are user-friendly

## Comparison Analysis

After running all tests, compare:

```
Metric                    | Rule-Based | ML-Powered | Improvement
--------------------------|------------|------------|------------
Keywords Extracted        | 79         | ~45        | -43% (more focused)
Quality Score             | 34.2%      | ~85%       | +51% (higher precision)
Excellent Resume Score    | 29/100     | ~80/100    | +51 points
Good Resume Score         | 10/100     | ~60/100    | +50 points
Poor Resume Score         | 4/100      | ~30/100    | +26 points
Extraction Time           | <100ms     | 2-5s       | Slower but acceptable
```

## Troubleshooting

### Model fails to load
- Check browser console for CORS or file access errors
- Verify model files are in `dist/models/bge-small-en-v1.5/`
- Ensure WASM files are in `dist/wasm/`

### Worker initialization timeout
- Model loading takes 10-30 seconds on first load
- Check Network tab for slow file downloads
- Verify files are cached after first load

### ML extraction falls back to rules
- Check console for error messages
- Verify Web Worker is running (check Sources tab)
- Test with simpler job descriptions first

## Next Steps

After validating improvements:
1. Document final metrics
2. Create comparison charts/graphs
3. Update README with actual results
4. Consider further optimizations (caching, model quantization)
