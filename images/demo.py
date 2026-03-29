
"""
demo.py — Run this WITHOUT API keys to see exactly what the output looks like.
Uses realistic mock ad data to demonstrate the full analysis pipeline.
"""

import json
from anthropic import Anthropic
import os

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# ─── Realistic mock ads (what Meta API actually returns) ───
MOCK_ADS = [
    {
        "id": "1234567890",
        "page_name": "ProShine Auto Detailing",
        "ad_creation_time": "2024-11-15",
        "ad_delivery_start_time": "2024-11-15",
        "ad_delivery_stop_time": None,
        "title": "Your Car Deserves More Than a Car Wash",
        "body_text": "Most car washes leave swirl marks and water spots. We don't.\n\nProShine uses a 12-step paint correction process that removes years of damage and protects your investment with a 3-year ceramic coating.\n\nLimited slots this month — book your free paint assessment today.",
        "description": "Professional ceramic coating & paint correction. Serving MA & RI.",
        "caption": "proshine-detailing.com",
        "publisher_platforms": ["facebook", "instagram"],
        "target_ages": ["25-34", "35-44", "45-54"],
        "target_gender": "all",
        "spend": {"lower_bound": "1000", "upper_bound": "5000"},
        "impressions": {"lower_bound": "50000", "upper_bound": "100000"},
        "demographic_distribution": [{"age": "35-44", "gender": "male", "percentage": "0.45"}],
        "delivery_by_region": [{"region": "Massachusetts", "percentage": "0.70"}, {"region": "Rhode Island", "percentage": "0.30"}],
        "ad_snapshot_url": "https://www.facebook.com/ads/archive/render_ad/?id=1234567890"
    },
    {
        "id": "2345678901",
        "page_name": "Elite Mobile Detailing MA",
        "ad_creation_time": "2024-10-01",
        "ad_delivery_start_time": "2024-10-01",
        "ad_delivery_stop_time": None,
        "title": "We Come To You 🚐 Mobile Detailing in Worcester & Surrounding Areas",
        "body_text": "⭐⭐⭐⭐⭐ 200+ 5-star reviews\n\nTired of driving to the detail shop? We bring the shop to your driveway.\n\n✅ Full interior deep clean\n✅ Hand wash & clay bar\n✅ Spray sealant\n\nStarting at $149. Book online in 60 seconds.",
        "description": "Mobile detailing — we come to your home or office.",
        "caption": "elitemobiledetailing.com",
        "publisher_platforms": ["facebook", "instagram", "messenger"],
        "target_ages": ["25-34", "35-44"],
        "target_gender": "all",
        "spend": {"lower_bound": "500", "upper_bound": "1000"},
        "impressions": {"lower_bound": "20000", "upper_bound": "50000"},
        "demographic_distribution": [{"age": "25-34", "gender": "male", "percentage": "0.52"}],
        "delivery_by_region": [{"region": "Massachusetts", "percentage": "1.00"}],
        "ad_snapshot_url": "https://www.facebook.com/ads/archive/render_ad/?id=2345678901"
    },
    {
        "id": "3456789012",
        "page_name": "CrystalCoat Ceramics",
        "ad_creation_time": "2024-09-20",
        "ad_delivery_start_time": "2024-09-20",
        "ad_delivery_stop_time": None,
        "title": "Before & After: 2019 BMW M3 — 6 Hours of Paint Correction",
        "body_text": "This BMW came in covered in swirl marks, water etching, and 3 years of neglect.\n\n6 hours later: mirror-finish paint topped with IGL Kenzo ceramic coating (5-year warranty).\n\nWe document EVERY job with before/after photos so you can see exactly what you're getting.\n\n📍 Serving Attleboro, Plainville, Foxborough, and all of Southeastern MA\n\nFree inspection this week only — tap to schedule.",
        "description": "5-year ceramic coating with full documentation. SE Massachusetts.",
        "caption": "crystalcoatma.com",
        "publisher_platforms": ["facebook", "instagram"],
        "target_ages": ["25-34", "35-44", "45-54", "55-64"],
        "target_gender": "male",
        "spend": {"lower_bound": "1000", "upper_bound": "5000"},
        "impressions": {"lower_bound": "50000", "upper_bound": "100000"},
        "demographic_distribution": [{"age": "35-44", "gender": "male", "percentage": "0.62"}],
        "delivery_by_region": [{"region": "Massachusetts", "percentage": "0.85"}, {"region": "Rhode Island", "percentage": "0.15"}],
        "ad_snapshot_url": "https://www.facebook.com/ads/archive/render_ad/?id=3456789012"
    },
    {
        "id": "4567890123",
        "page_name": "Spotless Auto Spa - Foxboro",
        "ad_creation_time": "2024-12-01",
        "ad_delivery_start_time": "2024-12-01",
        "ad_delivery_stop_time": None,
        "title": "Stop Wasting Money on Car Washes That Don't Work",
        "body_text": "The average car owner spends $600/year on car washes.\n\nFor less than that, you can get a professional detail + ceramic coating that repels water, dirt, and UV damage for 2+ years.\n\nWe're not a car wash. We're an investment in your vehicle.\n\n🏆 NDetail certified\n📍 Foxboro, MA (near Gillette Stadium)\n\nDM us for a free quote or call 508-XXX-XXXX",
        "description": "Professional detailing + ceramic coating. Foxboro MA.",
        "caption": "spotlessautospa.com",
        "publisher_platforms": ["facebook", "instagram", "audience_network"],
        "target_ages": ["30-39", "40-49", "50-59"],
        "target_gender": "all",
        "spend": {"lower_bound": "500", "upper_bound": "1000"},
        "impressions": {"lower_bound": "10000", "upper_bound": "50000"},
        "demographic_distribution": [{"age": "40-49", "gender": "male", "percentage": "0.48"}],
        "delivery_by_region": [{"region": "Massachusetts", "percentage": "1.00"}],
        "ad_snapshot_url": "https://www.facebook.com/ads/archive/render_ad/?id=4567890123"
    }
]


def format_ad_for_analysis(ad: dict) -> str:
    lines = [
        f"PAGE: {ad.get('page_name', 'Unknown')}",
        f"AD ID: {ad.get('id', 'N/A')}",
        f"STARTED: {ad.get('ad_delivery_start_time', 'N/A')}",
        "",
        "─── AD CREATIVE ───",
        f"TITLE: {ad.get('title', '(none)')}",
        f"BODY: {ad.get('body_text', '(none)')}",
        f"DESCRIPTION: {ad.get('description', '(none)')}",
        "",
        "─── AD SETTINGS ───",
        f"PLATFORMS: {', '.join(ad.get('publisher_platforms', []))}",
        f"TARGET AGES: {ad.get('target_ages', 'N/A')}",
        f"TARGET GENDER: {ad.get('target_gender', 'N/A')}",
        f"SPEND RANGE: {json.dumps(ad.get('spend', {}))}",
        f"IMPRESSIONS: {json.dumps(ad.get('impressions', {}))}",
    ]
    return "\n".join(lines)


def run_demo():
    print("=" * 60)
    print("  THE RESEARCHER — DEMO MODE (mock data)")
    print("  Showing what real output looks like")
    print("=" * 60)

    if not ANTHROPIC_API_KEY:
        print("\n⚠️  Set ANTHROPIC_API_KEY to see AI analysis")
        print("   Showing raw formatted ads instead:\n")
        for i, ad in enumerate(MOCK_ADS):
            print(f"\n{'─'*50}\nAD #{i+1}")
            print(format_ad_for_analysis(ad))
        return

    client = Anthropic(api_key=ANTHROPIC_API_KEY)

    ads_text = ("\n\n" + "═"*50 + "\n\n").join(
        f"AD #{i+1}\n{format_ad_for_analysis(ad)}"
        for i, ad in enumerate(MOCK_ADS)
    )

    prompt = f"""You are analyzing Meta (Facebook/Instagram) ads from car detailing businesses near Plainville, MA.

Produce a strategic breakdown covering:

1. **VIDEO & CREATIVE STRATEGY** — hooks, storytelling, before/afters, what transformation they showcase
2. **AD COPY PATTERNS** — headline formulas, offer structures, emotional triggers
3. **TARGETING & SETTINGS** — age/gender patterns, platform choices, spend signals
4. **TOP PERFORMING BUSINESSES** — who looks strongest and why
5. **STRATEGIC RECOMMENDATIONS** — what to copy, what gaps exist

Be specific, reference page names, and make it actionable.

AD DATA:
{ads_text}
"""

    print("\n🤖 Analyzing with Claude...\n")
    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}]
    )

    print("=" * 60)
    print("  ANALYSIS RESULTS")
    print("=" * 60)
    print(response.content[0].text)


if __name__ == "__main__":
    run_demo()
