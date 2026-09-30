from sentence_transformers import SentenceTransformer, util
import torch
import re


class SupplyChainNLP:
    def __init__(self):
        print("Loading Advanced Contrastive NLP Brain (all-MiniLM-L6-v2)...")

        self.model = SentenceTransformer("all-MiniLM-L6-v2")

        self.disaster_anchors = [
            "Catastrophic hurricane, typhoon, and severe weather destroys port.",
            "Massive earthquake and tsunami devastates coastal logistics hubs.",
            "Massive global worker strike and union protest shuts down logistics network.",
            "Massive bridge collapse and highway destruction severs supply chain artery.",
            "Cyberattack shuts down global port operating systems and tracking.",
            "Military blockade, war, and geopolitical conflict closes major maritime strait.",
            "Armed pirates hijack commercial vessel and hold crew hostage.",
            "Government embargo, bombs, and trade war halts international freight.",
        ]

        self.safe_anchors = [
            "Normal traffic, clear weather, sunny skies, and smooth operations.",
            "Routine delivery on time, no delays, safe and secure transport.",
            "Positive economic growth, peaceful conditions, business as usual.",
            "Traffic is flowing normally, roads are completely empty and clear.",
        ]

        # Encode anchors once during initialization
        self.disaster_embeddings = self.model.encode(
            self.disaster_anchors,
            convert_to_tensor=True,
            normalize_embeddings=True,
        )

        self.safe_embeddings = self.model.encode(
            self.safe_anchors,
            convert_to_tensor=True,
            normalize_embeddings=True,
        )

        print("Contrastive NLP Matrix Ready!")

    def chunk_text(self, text: str) -> list[str]:
        """
        Split text into sentences.
        """

        if not isinstance(text, str) or not text.strip():
            return []

        sentences = re.split(r"(?<=[.!?])\s+", text.strip())

        return [
            sentence.strip()
            for sentence in sentences
            if len(sentence.split()) > 3
        ]

    def generate_severity_score(self, news_text: str) -> float:
        """
        Generate a 0.0 - 1.0 disaster severity score.
        """

        chunks = self.chunk_text(news_text)

        if not chunks:
            return 0.0

        chunk_embeddings = self.model.encode(
            chunks,
            convert_to_tensor=True,
            normalize_embeddings=True,
        )

        disaster_scores = util.cos_sim(
            chunk_embeddings,
            self.disaster_embeddings,
        )

        safe_scores = util.cos_sim(
            chunk_embeddings,
            self.safe_embeddings,
        )

        max_final_threat = 0.0

        for i in range(len(chunks)):
            best_disaster = torch.max(disaster_scores[i]).item()
            best_safe = torch.max(safe_scores[i]).item()

            margin = best_disaster - best_safe

            max_final_threat = max(
                max_final_threat,
                margin,
            )

        # Ignore weak semantic differences
        threshold = 0.08

        if max_final_threat <= threshold:
            return 0.0

        calibration_multiplier = 3.5

        final_score = max_final_threat * calibration_multiplier

        return float(min(1.0, max(0.0, final_score)))

    def calculate_relevance(
        self,
        news_text: str,
        mode: str,
        origin: str,
        destination: str,
    ) -> float:

        if not isinstance(news_text, str):
            return 0.0

        text_lower = news_text.lower()

        mode_str = str(mode).lower().strip()
        origin_str = str(origin).lower().strip()
        destination_str = str(destination).lower().strip()

        sea_keywords = [
            "sea",
            "ocean",
            "ship",
            "port",
            "naval",
            "canal",
            "strait",
            "maritime",
            "pirate",
            "vessel",
        ]

        air_keywords = [
            "air",
            "flight",
            "airport",
            "plane",
            "aviation",
            "sky",
            "airspace",
        ]

        road_keywords = [
            "road",
            "highway",
            "truck",
            "traffic",
            "bridge",
            "street",
            "warehouse",
            "delivery",
            "van",
            "bike",
        ]

        # ---------------------------------------------------------
        # MODE RELEVANCE
        # ---------------------------------------------------------

        if mode_str in ["air", "aeroplane", "airplane", "flight"]:
            if any(
                word in text_lower for word in sea_keywords + road_keywords
            ) and not any(word in text_lower for word in air_keywords):
                return 0.0

        elif mode_str in ["sea", "ocean", "ship", "freight"]:
            if any(
                word in text_lower for word in air_keywords + road_keywords
            ) and not any(word in text_lower for word in sea_keywords):
                return 0.0

        elif mode_str in [
            "truck",
            "bike",
            "ev van",
            "van",
            "scooter",
            "ev bike",
            "road",
        ]:
            if any(
                word in text_lower for word in sea_keywords + air_keywords
            ) and not any(word in text_lower for word in road_keywords):
                return 0.0

        # ---------------------------------------------------------
        # GLOBAL EVENTS
        # ---------------------------------------------------------

        global_keywords = [
            "global",
            "worldwide",
            "international",
            "pandemic",
            "war",
            "global crisis",
        ]

        if any(word in text_lower for word in global_keywords):
            return 1.0

        # ---------------------------------------------------------
        # LOCATION RELEVANCE
        # ---------------------------------------------------------

        if origin_str and origin_str in text_lower:
            return 1.0

        if destination_str and destination_str in text_lower:
            return 1.0

        # ---------------------------------------------------------
        # DEFAULT
        # ---------------------------------------------------------

        return 0.2


def run_tests():

    print("\nInitializing SupplyChainNLP...\n")

    nlp = SupplyChainNLP()

    print("\n" + "=" * 70)
    print("SUPPLY CHAIN NLP TEST SUITE")
    print("=" * 70)

    test_cases = [
        (
            "Test 1: Pure Safe Baseline",
            "The delivery truck is on its way. "
            "Weather is clear, skies are sunny, and roads are completely empty.",
        ),
        (
            "Test 2: Minor Nuisance",
            "There is slight traffic near the downtown area "
            "due to a local food festival. Drivers might be delayed by ten minutes.",
        ),
        (
            "Test 3: The Diluted Black Swan",
            "The global economy is seeing massive growth. "
            "Stock markets are hitting all-time highs. "
            "Tech companies are thriving. "
            "However, a massive bomb destroyed the Suez Canal. "
            "Sports teams played well today, and agriculture is booming.",
        ),
        (
            "Test 4: Unseen Semantic Threat",
            "Armed pirates have hijacked a major commercial cargo vessel "
            "off the coast of Somalia and are holding the crew hostage.",
        ),
        (
            "Test 5: Catastrophic Infrastructure Failure",
            "A 9.0 magnitude earthquake has completely leveled "
            "the primary dispatch warehouse and shattered all connecting "
            "suspension bridges in the region.",
        ),
    ]

    for name, text in test_cases:

        score = nlp.generate_severity_score(text)

        print(f"\n--- {name} ---")
        print(f'Report: "{text}"')
        print(f"Severity Score: {score:.3f}")

        if score == 0.0:
            print("🟢 SAFE - NORMAL TRAFFIC")

        elif score < 0.8:
            print("🟡 WARNING - MODERATE RISK")

        else:
            print("🔴 CRITICAL - BLACK SWAN EVENT")

    print("\n" + "=" * 70)
    print("TEST COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
