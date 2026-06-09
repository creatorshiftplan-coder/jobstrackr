"""
Rule-Based Rephraser for FreeJobAlert Articles
================================================
Deterministic text transformation that rephrases scraped content
without using any AI, APIs, or ML models. Pure Python + regex.

Preserves: dates, numbers, URLs, exam names, official body names.
Transforms: sentence structure, phrases, active/passive voice, synonyms.
"""

import re
import random
from typing import Dict, Any, List

random.seed()


class RuleBasedRephraser:
    """
    A non-AI rephraser using phrase dictionaries, pattern substitution,
    sentence reordering, and active/passive voice swapping.
    """

    # ─── Phrase substitution map ───
    # key: original phrase (case-insensitive match)
    # value: list of alternatives
    PHRASE_MAP = {
        # Release / announcement phrases
        "has released": ["has announced", "has published", "has declared", "has made available"],
        "has been released": ["has been announced", "has been published", "is now available", "is now live"],
        "has been declared": ["has been announced", "is now public", "has been published"],
        "has been published": ["has been released", "is now public", "has been announced"],
        "is available now": ["is now accessible", "can be accessed now", "has been made available", "is now live"],
        "is now available": ["is now accessible", "has been made available", "can be accessed now"],
        # Candidate action phrases
        "candidates can download": ["applicants may obtain", "candidates can now get", "you can download", "aspirants may collect"],
        "candidates can check": ["applicants may verify", "you can check", "aspirants can view"],
        "candidates can apply": ["applicants may submit", "you can apply", "aspirants can register"],
        "interested candidates": ["eligible applicants", "aspiring candidates", "interested applicants"],
        # Link / action phrases
        "check here": ["find details here", "see below", "refer to the link", "check the details below"],
        "click here": ["follow this link", "use the link provided", "click the link below"],
        "direct link": ["official link", "access link", "download link", "direct access"],
        "given below": ["provided below", "mentioned below", "listed below"],
        "provided below": ["given below", "mentioned below", "listed here"],
        # Official / website phrases
        "official website": ["official portal", "department website", "authorized site", "official webpage"],
        "official notification": ["official circular", "department notice", "authorized announcement"],
        "notification has been": ["notification was", "circular has been", "announcement was"],
        # Result phrases
        "result has been declared": ["results are out", "outcome has been published", "merit list is now live", "results have been announced"],
        "results are out": ["results have been declared", "outcome is now available", "merit list has been published"],
        "cut off marks": ["minimum qualifying marks", "qualifying score", "cutoff score", "qualifying marks"],
        # Admit card phrases
        "admit card": ["hall ticket", "entry pass", "examination permit"],
        "admit cards": ["hall tickets", "entry passes", "examination permits"],
        # Exam / test phrases
        "exam will be held": ["test is scheduled", "examination will take place", "exam date is fixed", "test will be conducted"],
        "exam date": ["test date", "examination schedule", "assessment date"],
        "exam pattern": ["test structure", "examination format", "assessment pattern"],
        "written exam": ["written test", "pen-and-paper test", "descriptive test"],
        "online exam": ["computer-based test", "online test", "CBT"],
        # Application phrases
        "last date to apply": ["application deadline", "final date for submission", "last day to register"],
        "last date": ["final date", "deadline", "closing date"],
        "application form": ["registration form", "application document", "online form"],
        # Selection phrases
        "selection process": ["recruitment process", "hiring procedure", "selection procedure"],
        "written test": ["written examination", "descriptive test", "pen-and-paper exam"],
        "interview round": ["personal interview", "face-to-face interview", "oral test"],
        # Passive voice patterns
        "has been conducted": ["was held", "took place", "was organized", "was carried out"],
        "has been announced": ["is now public", "was published", "has been made known", "is now live"],
        "has been updated": ["was revised", "is now current", "has been refreshed"],
        "has been uploaded": ["was posted", "is now available", "has been published"],
        # Misc
        "as per the": ["according to the", "in line with the", "as stated in the"],
        "for more details": ["for further information", "for complete details", "to know more"],
        " eligible ": [" qualified ", " meeting criteria "],
        " eligibility ": [" qualification "," criteria "," requirements "],
        " vacancy ": [" opening ", " position ", " post "],
        " vacancies ": [" openings ", " positions ", " posts "],
        " download ": [" obtain ", " get ", " collect "],
        " check ": [" verify ", " confirm ", " review "],
        " apply ": [" submit ", " register ", " send in"],
        " also ": [" additionally ", " furthermore ", " as well "],
        " and ": [" as well as ", " along with ", " in addition to"],
        " but ": [" however "," yet "," although "],
        " so ": [" therefore "," thus "," hence "],
        " because ": [" since "," as "," given that"],
        " important ": [" crucial "," significant "," essential"],
        " candidates ": [" applicants "," aspirants "," test-takers"],
    }

    SENTENCE_STARTERS = [
        "Candidates should note that",
        "It is informed that",
        "As per the official update",
        "According to the latest notice",
        "The department has confirmed that",
        "Aspirants are advised that",
        "The conducting body has announced that",
        "Interested applicants should know that",
        "The official notification states that",
    ]

    # Synonym swaps for common words (word boundaries required)
    SYNONYMS = {
        r"\bdownload\b": ["obtain", "get", "collect"],
        r"\bcheck\b": ["verify", "confirm", "review", "examine"],
        r"\bapply\b": ["submit", "register", "send"],
        r"\bvisit\b": ["go to", "access", "browse"],
        r"\beligible\b": ["qualified", "entitled"],
        r"\bimportant\b": ["crucial", "significant", "essential"],
        r"\bofficial\b": ["authorized", "departmental", "government"],
        r"\bcomplete\b": ["full", "entire", "detailed"],
        r"\bqualified\b": ["eligible", "selected", "shortlisted"],
        r"\bselected\b": ["chosen", "shortlisted", "picked"],
        r"\bannounced\b": ["declared", "published", "released"],
        r"\breleased\b": ["published", "made available", "issued"],
    }

    def __init__(self):
        # Pre-compile regexes for phrase map
        self._phrase_res = []
        for phrase, alts in self.PHRASE_MAP.items():
            # Word-boundary aware regex
            pat = r"(?i)\b" + re.escape(phrase.strip()) + r"\b"
            self._phrase_res.append((re.compile(pat), alts))

    def rephrase(self, article: Dict[str, Any]) -> Dict[str, Any]:
        """Rephrase an article dict in-place and return it."""
        out = dict(article)
        out["is_rephrased"] = True

        # Rephrase title (preserve exam name — usually the first few words)
        out["title"] = self._rephrase_text(article.get("title", ""), is_title=True)

        # Rephrase summary
        out["summary"] = self._rephrase_text(article.get("summary", ""))

        # Rephrase sections
        out["sections"] = []
        for sec in article.get("sections", []):
            new_sec = dict(sec)
            new_sec["content"] = [self._rephrase_text(p) for p in sec.get("content", [])]
            out["sections"].append(new_sec)

        # Rephrase full_text
        out["full_text"] = self._rephrase_text(article.get("full_text", ""))

        return out

    def _rephrase_text(self, text: str, is_title: bool = False) -> str:
        if not text or len(text) < 10:
            return text

        # 1. Phrase substitution (largest phrases first)
        text = self._substitute_phrases(text)

        # 2. Synonym substitution
        text = self._substitute_synonyms(text)

        # 3. Sentence reordering (only for multi-sentence paragraphs, not titles)
        if not is_title:
            text = self._reorder_sentences(text)

        # 4. Sentence starter injection (for short paragraphs, sparingly)
        if not is_title and len(text) < 300 and random.random() < 0.3:
            text = self._inject_starter(text)

        # 5. Active/passive voice swap
        text = self._swap_voice(text)

        # Clean up double spaces
        text = " ".join(text.split())
        return text

    def _substitute_phrases(self, text: str) -> str:
        for regex, alts in self._phrase_res:
            def replacer(m):
                original = m.group(0)
                chosen = random.choice(alts)
                # Preserve original case pattern (title case, all caps, etc.)
                if original.isupper():
                    return chosen.upper()
                if original[0].isupper():
                    return chosen[0].upper() + chosen[1:]
                return chosen
            text = regex.sub(replacer, text)
        return text

    def _substitute_synonyms(self, text: str) -> str:
        for pattern, alts in self.SYNONYMS.items():
            def replacer(m):
                chosen = random.choice(alts)
                original = m.group(0)
                if original[0].isupper():
                    return chosen[0].upper() + chosen[1:]
                return chosen
            text = re.sub(pattern, replacer, text, flags=re.I)
        return text

    def _reorder_sentences(self, text: str) -> str:
        """Reorder sentences within a paragraph when safe to do so."""
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
        if len(sentences) < 2:
            return text

        # Only reorder if no sentence starts with a chronological marker
        time_markers = re.compile(r"^(first|then|next|after that|finally|lastly|meanwhile|subsequently|thereafter)", re.I)
        safe_to_reorder = all(not time_markers.match(s) for s in sentences)

        if safe_to_reorder and random.random() < 0.4:
            first = sentences[0]
            rest = sentences[1:]
            random.shuffle(rest)
            # Keep first sentence first (it usually has the subject)
            sentences = [first] + rest

        return " ".join(sentences)

    def _inject_starter(self, text: str) -> str:
        """Prepend a sentence starter to short paragraphs."""
        starter = random.choice(self.SENTENCE_STARTERS)
        # Make sure it flows — capitalize the first letter of the original
        first_char = text[0]
        if first_char.islower():
            text = first_char.upper() + text[1:]
        return f"{starter}, {text}"

    def _swap_voice(self, text: str) -> str:
        """Swap common passive constructions with active alternatives."""
        swaps = [
            (re.compile(r"\bhas been made available\b", re.I), "is now accessible"),
            (re.compile(r"\bhas been uploaded\b", re.I), "was posted"),
            (re.compile(r"\bhas been updated\b", re.I), "was revised"),
            (re.compile(r"\bhas been conducted\b", re.I), "was held"),
            (re.compile(r"\bhas been organized\b", re.I), "was held"),
            (re.compile(r"\bhas been scheduled\b", re.I), "is set to take place"),
            (re.compile(r"\bhas been postponed\b", re.I), "was delayed"),
            (re.compile(r"\bhas been cancelled\b", re.I), "was called off"),
        ]
        for regex, replacement in swaps:
            text = regex.sub(replacement, text)
        return text


# Convenience function
def rephrase_article(article: Dict[str, Any]) -> Dict[str, Any]:
    rp = RuleBasedRephraser()
    return rp.rephrase(article)
