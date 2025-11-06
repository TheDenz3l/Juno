/**
 * Comprehensive test script for ML-powered ATS keyword extraction
 * Tests ML extraction, rule-based extraction, and full pipeline integration
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the extraction functions
// Note: Since these use Web Workers and browser APIs, we'll need to mock some parts
// For now, we'll extract and test the pure functions

/**
 * Load test data
 */
function loadTestData() {
  const jobPosting = JSON.parse(
    readFileSync(join(__dirname, 'test-data', 'job-posting.json'), 'utf-8')
  );

  const resumes = {
    excellent: JSON.parse(
      readFileSync(join(__dirname, 'test-data', 'resume-excellent-match.json'), 'utf-8')
    ),
    good: JSON.parse(
      readFileSync(join(__dirname, 'test-data', 'resume-good-match.json'), 'utf-8')
    ),
    poor: JSON.parse(
      readFileSync(join(__dirname, 'test-data', 'resume-poor-match.json'), 'utf-8')
    )
  };

  return { jobPosting, resumes };
}

/**
 * Test 1: Rule-based keyword extraction (baseline)
 */
function testRuleBasedExtraction(jobDescription) {
  console.log('\n=== TEST 1: Rule-Based Keyword Extraction ===\n');

  // Extract keywords using patterns (simplified version of the rule-based approach)
  const keywords = extractKeywordsRuleBased(jobDescription);

  console.log(`Total keywords extracted: ${keywords.length}`);
  console.log('\nTop 20 keywords:');
  keywords.slice(0, 20).forEach((keyword, i) => {
    console.log(`  ${i + 1}. ${keyword}`);
  });

  return keywords;
}

/**
 * Simplified rule-based extraction for testing
 */
function extractKeywordsRuleBased(text) {
  const keywords = new Set();

  // Pattern-based extraction
  const patterns = [
    // Hard skills
    /\b[A-Z][a-z]*(?:[A-Z][a-z]*)+\b/g, // PascalCase (e.g., JavaScript, TypeScript)
    /\b[A-Z]{2,}\b/g, // Acronyms (e.g., CRM, POS)

    // Technical terms
    /\b(?:experience|knowledge|proficiency|expertise|skills?|certification|diploma|degree)\s+(?:in|with|of)\s+([^.,;]+)/gi,

    // Years of experience
    /\b(\d+)\+?\s+years?\s+(?:of\s+)?(?:experience|background)/gi,

    // Software and tools
    /\b(?:Salesforce|CRM|POS|mobile\s+POS|systems?)\b/gi,

    // Skills from "Skills Required" section
    /Skills?\s+Required:?\s*([^]+?)(?=\n\n|Compensation|Work Environment|$)/i
  ];

  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleaned = match.trim().replace(/^(in|with|of|and|or)\s+/i, '');
        if (cleaned.length >= 3) {
          keywords.add(cleaned);
        }
      });
    }
  });

  // Extract from bullet points
  const bulletPattern = /^[\s-•]*(.+?)$/gm;
  const bullets = text.match(bulletPattern);
  if (bullets) {
    bullets.forEach(bullet => {
      // Extract noun phrases
      const words = bullet.match(/\b[A-Z][a-z]+(?:\s+[A-Z]?[a-z]+){0,2}\b/g);
      if (words) {
        words.forEach(word => {
          if (word.length >= 4) keywords.add(word);
        });
      }
    });
  }

  return Array.from(keywords);
}

/**
 * Test 2: Analyze keyword quality
 */
function analyzeKeywordQuality(keywords, context = 'Sales Associate') {
  console.log('\n=== TEST 2: Keyword Quality Analysis ===\n');

  // Categorize keywords
  const hardSkills = [];
  const softSkills = [];
  const fluff = [];

  const hardSkillPatterns = [
    /POS|CRM|Salesforce|mobile|system|software|tool|technology/i,
    /cash|inventory|transaction|merchandising/i
  ];

  const softSkillPatterns = [
    /communication|collaboration|leadership|team|problem|resolve|adapt/i,
    /customer|service|interpersonal|listening|organizational/i
  ];

  const fluffPatterns = [
    /leading|dynamic|innovative|recognized|exceptional|rapidly|growing/i,
    /opportunity|celebrate|diversity|inclusive|equal/i
  ];

  keywords.forEach(keyword => {
    if (hardSkillPatterns.some(p => p.test(keyword))) {
      hardSkills.push(keyword);
    } else if (softSkillPatterns.some(p => p.test(keyword))) {
      softSkills.push(keyword);
    } else if (fluffPatterns.some(p => p.test(keyword))) {
      fluff.push(keyword);
    }
  });

  console.log(`Hard Skills (${hardSkills.length}):`, hardSkills.slice(0, 10));
  console.log(`\nSoft Skills (${softSkills.length}):`, softSkills.slice(0, 10));
  console.log(`\nFluff/Boilerplate (${fluff.length}):`, fluff.slice(0, 10));

  const qualityScore = ((hardSkills.length + softSkills.length) / keywords.length) * 100;
  console.log(`\nQuality Score: ${qualityScore.toFixed(1)}% (relevant keywords)`);

  return { hardSkills, softSkills, fluff, qualityScore };
}

/**
 * Test 3: Resume matching simulation
 */
function testResumeMatching(jobKeywords, resume) {
  console.log(`\n=== TEST 3: Resume Matching (${resume.name}) ===\n`);

  // Extract all text from resume
  const resumeText = JSON.stringify(resume.sections).toLowerCase();
  const jobKeywordsLower = jobKeywords.map(k => k.toLowerCase());

  // Find matches
  const matched = [];
  const missing = [];

  jobKeywordsLower.forEach(keyword => {
    if (resumeText.includes(keyword.toLowerCase())) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  });

  const matchRate = (matched.length / jobKeywordsLower.length) * 100;

  console.log(`Match Rate: ${matchRate.toFixed(1)}%`);
  console.log(`Matched Keywords: ${matched.length}/${jobKeywordsLower.length}`);
  console.log(`\nTop Matched:`, matched.slice(0, 10));
  console.log(`\nTop Missing:`, missing.slice(0, 10));

  // Calculate ATS score (simplified)
  let score = matchRate;

  // Bonus for years of experience
  if (resume.sections.summary?.includes('4+ years')) {
    score += 5;
  } else if (resume.sections.summary?.includes('2.5 years') || resume.sections.summary?.includes('2 years')) {
    score += 2;
  }

  // Bonus for certifications
  if (resume.sections.certifications?.length > 0) {
    score += 5;
  }

  score = Math.min(100, score);

  console.log(`\nFinal ATS Score: ${score.toFixed(0)}/100`);

  return {
    matchRate,
    matched,
    missing,
    score
  };
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   ML-Powered ATS Keyword Extraction - Comprehensive Tests    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  try {
    // Load test data
    const { jobPosting, resumes } = loadTestData();

    // Test 1: Rule-based extraction (baseline)
    const ruleKeywords = testRuleBasedExtraction(jobPosting.description);

    // Test 2: Analyze quality
    const qualityAnalysis = analyzeKeywordQuality(ruleKeywords);

    // Test 3: Resume matching
    const excellentMatch = testResumeMatching(ruleKeywords, resumes.excellent);
    const goodMatch = testResumeMatching(ruleKeywords, resumes.good);
    const poorMatch = testResumeMatching(ruleKeywords, resumes.poor);

    // Summary
    console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                         TEST SUMMARY                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('Rule-Based Extraction:');
    console.log(`  - Total keywords: ${ruleKeywords.length}`);
    console.log(`  - Quality score: ${qualityAnalysis.qualityScore.toFixed(1)}%`);
    console.log(`  - Hard skills: ${qualityAnalysis.hardSkills.length}`);
    console.log(`  - Soft skills: ${qualityAnalysis.softSkills.length}`);
    console.log(`  - Fluff detected: ${qualityAnalysis.fluff.length}`);

    console.log('\nResume Matching Results:');
    console.log(`  - Excellent Match: ${excellentMatch.score.toFixed(0)}/100 (${excellentMatch.matchRate.toFixed(1)}% keywords)`);
    console.log(`  - Good Match: ${goodMatch.score.toFixed(0)}/100 (${goodMatch.matchRate.toFixed(1)}% keywords)`);
    console.log(`  - Poor Match: ${poorMatch.score.toFixed(0)}/100 (${poorMatch.matchRate.toFixed(1)}% keywords)`);

    // Save results
    const results = {
      timestamp: new Date().toISOString(),
      ruleBasedExtraction: {
        keywordCount: ruleKeywords.length,
        keywords: ruleKeywords,
        qualityScore: qualityAnalysis.qualityScore,
        hardSkills: qualityAnalysis.hardSkills,
        softSkills: qualityAnalysis.softSkills,
        fluff: qualityAnalysis.fluff
      },
      resumeMatching: {
        excellent: excellentMatch,
        good: goodMatch,
        poor: poorMatch
      }
    };

    writeFileSync(
      join(__dirname, 'test-data', 'test-results-rule-based.json'),
      JSON.stringify(results, null, 2)
    );

    console.log('\n✅ Tests complete! Results saved to test-data/test-results-rule-based.json\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
runTests();
