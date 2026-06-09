# 🏗️ JobsTrackr Final Architecture: ML-Driven Job Matching

## Overview

The current v3 is a **rule-based system** with structured caching, fuzzy matching, and skill levels. The **final version** replaces arbitrary rules with learned behavior, semantic understanding, and a structured knowledge graph.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                              │
│  React / Next.js → Job Cards, Gap Reports, Eligibility Tiers           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                         API LAYER (Edge Functions)                      │
│  Supabase Edge Functions → match-jobs, generate-tags, ai-job-search    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                      MATCHING ENGINE (v4 - ML Driven)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Embedding   │  │   Learned    │  │   Knowledge  │  │  Feedback  │ │
│  │   Encoder    │  │   Scorer     │  │    Graph     │  │   Loop     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                      │
│  PostgreSQL (Supabase) + pgvector + Redis Cache                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component 1: Embedding Encoder

### Problem
Regex can't understand semantics. "B.Tech Computer Science" and "B.E. CSE" are equivalent, but "B.Tech Computer Science" and "B.Tech Food Technology" are completely different.

### Solution
Use sentence embeddings to encode:
- Job descriptions → dense vector (384-768 dimensions)
- User profiles → dense vector
- Qualification names → dense vector

### Technology
- **Model**: `sentence-transformers/all-MiniLM-L6-v2` (lightweight, 22M params) or Indian-specific fine-tuned model
- **Storage**: `pgvector` extension in PostgreSQL for vector similarity search
- **Similarity**: Cosine similarity > 0.85 = "same meaning"

### Example
```sql
-- Store job embedding
INSERT INTO job_embeddings (job_id, embedding)
VALUES ('job-123', '[0.023, -0.156, ...]');

-- Find semantically similar jobs
SELECT job_id, embedding <=> user_embedding AS distance
FROM job_embeddings
WHERE embedding <=> user_embedding < 0.3
ORDER BY distance;
```

---

## Component 2: Learned Scorer

### Problem
Current scoring uses arbitrary weights:
```typescript
if (sectorMatch) score += 3;
if (daysLeft <= 7) score += 2;
```
These are **guessed**, not proven.

### Solution
Train a ranking model on user behavior:

**Features (X):**
- Location match score (0-3)
- Sector match (0/1)
- Skill overlap count
- Qualification level gap
- Experience gap
- Salary alignment
- Days until deadline
- Vacancy count
- Job category
- User category (OBC/SC/ST/etc.)

**Labels (y):**
- Did user click the job? (0/1)
- Did user save the job? (0/1)
- Did user apply? (0/1)

**Model:**
- Start: Logistic Regression (interpretable)
- Scale: Gradient Boosting (XGBoost/LightGBM)
- Advanced: Neural network with job/user embeddings

### Training Pipeline
```python
# Weekly retraining
features = extract_features(user_jobs_interactions)
model = xgboost.XGBClassifier()
model.fit(features.X, features.y)
# Deploy new model version
```

---

## Component 3: Structured Knowledge Graph

### Problem
Indian government jobs have complex, evolving rules:
- "3 years experience" might mean "post-qualification experience" or "total experience"
- Age relaxation varies by post, not just category
- Some jobs accept "equivalent" qualifications not explicitly listed

### Solution
Build a knowledge graph of:
- **Qualifications**: Nodes with equivalence edges
- **Organizations**: UPSC → SSC → State PSCs → PSUs
- **Posts**: IAS → Group A → Administrative → DM
- **Rules**: Age rules, experience rules, reservation rules

### Graph Schema (Neo4j or RDF)
```cypher
// Qualification equivalence
CREATE (btech:Qualification {name: "B.Tech", level: 4, stream: "engineering"})
CREATE (be:Qualification {name: "B.E", level: 4, stream: "engineering"})
CREATE (btech)-[:EQUIVALENT_TO {confidence: 1.0}]->(be)

// Post hierarchy
CREATE (ias:Post {name: "IAS", group: "A", level: "All India"})
CREATE (dm:Post {name: "District Magistrate", group: "A", level: "District"})
CREATE (ias)-[:LEADS_TO]->(dm)

// Organization hierarchy
CREATE (upsc:Org {name: "UPSC", type: "Constitutional"})
CREATE (ssc:Org {name: "SSC", type: "Statutory"})
CREATE (upsc)-[:HIGHER_THAN]->(ssc)
```

### Usage
```typescript
// Instead of regex, query the graph
const equivalentQuals = await graph.query(`
  MATCH (q:Qualification {name: $userQual})-[:EQUIVALENT_TO*0..2]-(eq)
  RETURN eq.name
`, { userQual: "B.Tech" });
// Returns: ["B.E", "Bachelor of Technology", "B.Tech (Hons)"]
```

---

## Component 4: Feedback Loop

### Problem
We don't know if our "eligible" jobs are actually being applied to.

### Solution
Track every interaction:

| Event | Data Stored |
|-------|-------------|
| Job shown | user_id, job_id, match_score, tier, timestamp |
| Job clicked | user_id, job_id, click_position, time_to_click |
| Job saved | user_id, job_id, save_timestamp |
| Job applied | user_id, job_id, application_timestamp, source |
| Job dismissed | user_id, job_id, dismiss_reason |

### Analytics Dashboard
```sql
-- Click-through rate by eligibility tier
SELECT 
  eligibility_tier,
  COUNT(*) as impressions,
  SUM(clicks) as clicks,
  ROUND(SUM(clicks)::numeric / COUNT(*)::numeric, 4) as ctr
FROM job_impressions
GROUP BY eligibility_tier;
```

### Retraining Trigger
- Weekly: Retrain scorer if CTR drops > 10%
- Monthly: Full model retrain
- Real-time: A/B test new scoring weights

---

## Data Flow: How a Match Happens (v4)

```
1. User opens app
   ↓
2. Fetch user profile (with cached embedding)
   ↓
3. Vector search: Find top 500 semantically similar jobs
   ↓
4. Filter: Apply hard constraints (age, qualification level, gender)
   ↓
5. Score: Learned model ranks remaining jobs
   ↓
6. Tier: Classify into fully_eligible / near_eligible / skill_gap
   ↓
7. Enrich: Query knowledge graph for gap analysis
   ↓
8. Return: Top 50 jobs with gap reports
   ↓
9. Track: Log impressions, clicks, saves, applications
   ↓
10. Retrain: Update model weekly with new interaction data
```

---

## Technology Stack

| Component | Current (v3) | Final (v4) |
|-----------|-------------|------------|
| Qualification matching | Regex + fuzzy string | Embeddings + knowledge graph |
| Skill detection | Regex patterns | NLP NER + taxonomy |
| Scoring | Arbitrary weights | Learned XGBoost model |
| Job requirements | Parsed on-the-fly | Pre-computed + cached in DB |
| Location matching | String contains | Embedding + geo hierarchy |
| Gap analysis | Rule-based | Graph traversal + LLM summary |
| Language support | English only | Hindi + English + regional |

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
- [ ] Set up pgvector in Supabase
- [ ] Build qualification equivalence graph (manual curation)
- [ ] Add embedding generation pipeline
- [ ] Store pre-computed JobRequirements in DB

### Phase 2: Learning (Weeks 5-8)
- [ ] Implement interaction tracking
- [ ] Build analytics dashboard
- [ ] Train initial logistic regression scorer
- [ ] A/B test vs. rule-based scoring

### Phase 3: Intelligence (Weeks 9-12)
- [ ] Fine-tune sentence transformer on Indian job data
- [ ] Expand knowledge graph to 1000+ qualification nodes
- [ ] Add Hindi language support (IndicBERT embeddings)
- [ ] Implement "becoming eligible" predictor

### Phase 4: Scale (Weeks 13-16)
- [ ] Real-time model serving (Redis + ONNX)
- [ ] Personalized job alerts based on gap analysis
- [ ] Community-driven qualification equivalence submissions
- [ ] Integration with application tracking (auto-fill forms)

---

## Key Metrics to Track

| Metric | Target | Current |
|--------|--------|---------|
| Match accuracy (human-rated) | > 90% | ~70% (estimated) |
| Click-through rate (eligible jobs) | > 15% | Unknown |
| Application conversion rate | > 5% | Unknown |
| False positive rate (ineligible shown as eligible) | < 2% | ~10% (estimated) |
| Near-eligible → eligible conversion | > 20% | Unknown |
| Model inference time (p99) | < 100ms | ~500ms (regex) |

---

## Why This Beats the Rule-Based Approach

| Scenario | Rule-Based (v3) | ML-Driven (v4) |
|----------|----------------|----------------|
| "B.Tech CSE" vs "B.E. Computer Science" | Fuzzy string match (80% confidence) | Embedding similarity (95% confidence) |
| "3 years experience in relevant field" | Regex catches "3 years" | NLP understands "relevant field" = user's domain |
| User clicks jobs with high salary but wrong location | Still shows location-matched jobs first | Learns user prioritizes salary over location |
| New job type appears ("AI Ethics Officer") | Regex pattern missing | Embedding catches semantic similarity to existing jobs |
| Hindi eligibility text | Completely missed | IndicBERT embeddings understand Hindi |

---

## Conclusion

**v3 (current)** = Solid production code with structured caching, fuzzy matching, and skill levels. Fixes all obvious bugs.

**v4 (final)** = Intelligence layer on top of v3. Same structured data, but scoring, matching, and gap analysis are learned from real user behavior rather than hardcoded rules.

The transition path: **v3 runs in production → collect interaction data → train v4 models → A/B test → gradually replace rule-based components with learned ones.**
